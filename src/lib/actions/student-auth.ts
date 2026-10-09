'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MEMBER_EMAIL_DOMAIN } from '@/lib/education';

export type AuthState = { error?: string; name?: string; step?: 'confirm' };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const PIN_RE = /^\d{6}$/;
const MAX_TRIES = 5;
const emailOf = (regKey: string) => `${regKey.toLowerCase()}@${MEMBER_EMAIL_DOMAIN}`;

async function identify(reg: string, phone: string) {
  const admin = createAdminClient();
  const { data } = await admin.rpc('member_identify', { p_reg: reg, p_phone: phone });
  return (data as { member_id: string; full_name: string; reg_key: string; has_account: boolean }[] | null)?.[0] ?? null;
}

async function derivedPassword(regKey: string, pin: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('member_password', { p_reg_key: regKey, p_pin: pin });
  if (error || !data) throw new Error('password derivation failed');
  return data as string;
}

/** Step 1: registration ID + the phone on record → show only the name to confirm. */
export async function identifyMember(_: AuthState, fd: FormData): Promise<AuthState> {
  const m = await identify(text(fd, 'reg_no'), text(fd, 'phone'));
  if (!m) return { error: 'የመመዝገቢያ ቁጥሩ ወይም ስልኩ ሲመዘገቡ ካስገቡት ጋር አይመሳሰልም። እባክዎ በትክክል ያስገቡ ወይም ቢሮ ቁጥር 7 ይምጡ።' };
  if (m.has_account) return { error: 'ቀደም ብለው ተመዝግበዋል። በመመዝገቢያ ቁጥርዎ እና በፒንዎ ይግቡ። ፒኑን ከረሱ ትምህርት ክፍልን ያነጋግሩ።' };
  return { step: 'confirm', name: m.full_name };
}

/** Step 2: create the 6-digit PIN, sign in, and register for the active academic year. */
export async function createMemberAccount(_: AuthState, fd: FormData): Promise<AuthState> {
  const pin = text(fd, 'pin');
  if (!PIN_RE.test(pin)) return { error: 'ፒኑ 6 አሃዝ መሆን አለበት።', step: 'confirm' };
  if (pin !== text(fd, 'pin2')) return { error: 'ሁለቱ ፒኖች አይመሳሰሉም።', step: 'confirm' };
  if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') return { error: 'በቀላሉ የሚገመት ፒን አይጠቀሙ።', step: 'confirm' };
  const m = await identify(text(fd, 'reg_no'), text(fd, 'phone'));
  if (!m) return { error: 'መረጃው አልተገኘም። እንደገና ይጀምሩ።' };
  if (m.has_account) return { error: 'ቀደም ብለው ተመዝግበዋል። ይግቡ።' };

  const admin = createAdminClient();
  const password = await derivedPassword(m.reg_key, pin);
  const { data: created, error } = await admin.auth.admin.createUser({
    email: emailOf(m.reg_key), password, email_confirm: true, user_metadata: { member: true },
  });
  if (error || !created.user) return { error: 'መለያ መፍጠር አልተቻለም። ትምህርት ክፍልን ያነጋግሩ።', step: 'confirm' };
  const { error: linkErr } = await admin.from('member_accounts').insert({ member_id: m.member_id, user_id: created.user.id });
  if (linkErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: 'መለያ መፍጠር አልተቻለም። ትምህርት ክፍልን ያነጋግሩ።', step: 'confirm' };
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: emailOf(m.reg_key), password });
  if (fd.get('enroll') === 'on') await supabase.rpc('enroll_self');
  redirect('/choose');
}

/** Registration ID + PIN; 5 wrong PINs lock the account until ትምህርት ክፍል unlocks it. */
export async function loginMember(_: AuthState, fd: FormData): Promise<AuthState> {
  const reg = text(fd, 'reg_no').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const pin = text(fd, 'pin');
  if (reg.length !== 8 || !PIN_RE.test(pin)) return { error: 'የመመዝገቢያ ቁጥርዎን እና 6 አሃዝ ፒንዎን ያስገቡ።' };
  const admin = createAdminClient();
  const { data: member } = await admin.from('members').select('id, reg_key, is_active').eq('reg_key', reg).maybeSingle();
  const { data: acct } = member
    ? await admin.from('member_accounts').select('member_id, failed_attempts, locked_at').eq('member_id', member.id).maybeSingle()
    : { data: null };
  if (!member) {
    const { data: app } = await admin.from('member_applications').select('status').eq('reg_key', reg).maybeSingle();
    if (app?.status === 'pending') return { error: 'ምዝገባዎ ገና አልጸደቀም። የምዝገባ ቅጽዎን ይዘው ወደ የሰው ሃብት አስተዳደር (ቢሮ ቁጥር 7) ይምጡ።' };
    if (app?.status === 'rejected') return { error: 'ምዝገባዎ ተቀባይነት አላገኘም። የሰው ሃብት አስተዳደርን (ቢሮ ቁጥር 7) ያነጋግሩ።' };
  }
  if (!member || !member.is_active || !acct) return { error: 'መለያ አልተገኘም። መጀመሪያ “መለያ ይፍጠሩ” የሚለውን ይጠቀሙ።' };
  if (acct.locked_at) return { error: 'መለያዎ ተቆልፏል። እባክዎ ትምህርት ክፍልን ያነጋግሩ።' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: emailOf(member.reg_key), password: await derivedPassword(member.reg_key, pin) });
  if (error) {
    const tries = acct.failed_attempts + 1;
    await admin.from('member_accounts').update({
      failed_attempts: tries, locked_at: tries >= MAX_TRIES ? new Date().toISOString() : null,
    }).eq('member_id', member.id);
    return { error: tries >= MAX_TRIES ? 'ፒኑ 5 ጊዜ ተሳስቷል፤ መለያዎ ተቆልፏል። ትምህርት ክፍልን ያነጋግሩ።' : `ፒኑ ትክክል አይደለም (${MAX_TRIES - tries} ሙከራ ቀርቷል)።` };
  }
  await admin.from('member_accounts').update({ failed_attempts: 0, last_login_at: new Date().toISOString() }).eq('member_id', member.id);
  const next = text(fd, 'next');
  // One role → straight in; two or three → the chooser (ተማሪ / መምህር / አመራር).
  redirect(/^\/(staff|student)(\/|$)/.test(next) ? next : '/choose');
}

export async function logoutMember() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function enrollSelf() {
  const supabase = await createClient();
  const { error } = await supabase.rpc('enroll_self');
  if (error) return { error: error.message.includes('no_active_year') ? 'የትምህርት ዘመኑ ገና አልተከፈተም።' : 'መመዝገብ አልተቻለም።' };
  revalidatePath('/student');
}
