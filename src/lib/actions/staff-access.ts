'use server';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDeptCode } from '@/lib/constants';
import type { FormState } from '@/components/media-form';

/**
 * ጽሕፈት ቤት gives a member access to department pages. The member signs in with
 * their own registration number + PIN; this only links that login to departments.
 */
export async function grantStaffAccess(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('office');
  const memberId = String(fd.get('member_id') ?? '');
  const depts = fd.getAll('depts').map(String).filter(isDeptCode);
  if (depts.length === 0) return { error: 'ቢያንስ አንድ ክፍል ይምረጡ (ፈቃዱን ለማንሳት “ፈቃድ አንሳ” ይጫኑ)።' };

  const admin = createAdminClient();
  const [{ data: m }, { data: acct }] = await Promise.all([
    admin.from('members').select('id, full_name, sex, reg_key, is_active').eq('id', memberId).maybeSingle(),
    admin.from('member_accounts').select('user_id').eq('member_id', memberId).maybeSingle(),
  ]);
  if (!m || !m.is_active) return { error: 'አባሉ አልተገኘም።' };
  if (!acct) return { error: 'ይህ አባል ገና የመግቢያ ፒን አልፈጠረም። በ“መለያ ይፍጠሩ” ገጽ (መለያ ቁጥር + ስልክ) ፒን እንዲፈጥሩ ያድርጉ፤ ከዚያ እዚህ ፈቃድ ይስጡ።' };

  const { data: existing } = await admin.from('staff_profiles').select('is_admin').eq('user_id', acct.user_id).maybeSingle();
  if (existing?.is_admin) return { error: 'የሲስተም አስተዳዳሪ መለያ እዚህ አይቀየርም።' };
  const { error: pErr } = await admin.from('staff_profiles').upsert({
    user_id: acct.user_id, username: `m.${m.reg_key.toLowerCase()}`, full_name: m.full_name, sex: m.sex,
    member_id: m.id, is_admin: false, is_active: true,
  }, { onConflict: 'user_id' });
  if (pErr) return { error: pErr.message };
  await admin.from('staff_departments').delete().eq('user_id', acct.user_id);
  const { error: dErr } = await admin.from('staff_departments').insert(depts.map((dept) => ({ user_id: acct.user_id, dept })));
  if (dErr) return { error: dErr.message };
  revalidatePath('/staff/office/staff-access');
  return { ok: `${m.full_name} — ፈቃዱ ተቀምጧል።` };
}

export async function revokeStaffAccess(userId: string) {
  await requireDept('office');
  const admin = createAdminClient();
  const { data: p } = await admin.from('staff_profiles').select('is_admin, member_id').eq('user_id', userId).maybeSingle();
  if (!p || p.is_admin || !p.member_id) return { error: 'ይህ መለያ እዚህ አይቀየርም።' };
  await admin.from('staff_departments').delete().eq('user_id', userId);
  const { error } = await admin.from('staff_profiles').update({ is_active: false }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/staff/office/staff-access');
}
