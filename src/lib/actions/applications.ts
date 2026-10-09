'use server';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMemberForm, DUPLICATE_NAME_MSG } from '@/lib/member-parse';
import type { FormState } from '@/components/media-form';
import { MEMBER_EMAIL_DOMAIN } from '@/lib/education';

export type ApplicationState = FormState & { appId?: string; regNo?: string };
const PIN_RE = /^\d{6}$/;

async function isOpen() {
  const admin = createAdminClient();
  const { data } = await admin.rpc('registration_is_open');
  return data === true;
}

/** Public form: a one-time upload slot in the private bucket (only while registration is open). */
export async function applicationUploadUrl(name: string): Promise<{ path: string; token: string } | { error: string }> {
  if (!(await isOpen())) return { error: 'ምዝገባው ተዘግቷል።' };
  const safe = String(name).replace(/[^\w.\-]+/g, '_').slice(-60) || 'file';
  const path = `applications/${crypto.randomUUID()}-${safe}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from('member-docs').createSignedUploadUrl(path);
  if (error || !data) return { error: 'ፋይል መጫን አልተቻለም። እንደገና ይሞክሩ።' };
  return { path: data.path, token: data.token };
}

/** Public self-registration → waits for HR in the applications list. */
export async function submitApplication(_: ApplicationState, fd: FormData): Promise<ApplicationState> {
  if (!(await isOpen())) return { error: 'ምዝገባው ለጊዜው ተዘግቷል። እባክዎ ቢሮ ቁጥር 7 በአካል ይምጡ።' };
  for (const k of ['id', 'application_id']) fd.delete(k);
  const pin = String(fd.get('pin') ?? '');
  if (!PIN_RE.test(pin)) return { error: 'ባለ 6 አሃዝ መግቢያ ኮድ ይፍጠሩ።' };
  if (pin !== String(fd.get('pin2') ?? '')) return { error: 'ሁለቱ መግቢያ ኮዶች አይመሳሰሉም።' };
  if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') return { error: 'በቀላሉ የሚገመት ኮድ አይጠቀሙ።' };
  const parsed = parseMemberForm(fd, true);
  if ('error' in parsed) return { error: parsed.error };
  if (!parsed.phone) return { error: 'ስልክ ቁጥር ያስገቡ።' };
  const paths = [parsed.member.photo_path, (parsed.member.prior_school as { evidence_path?: string } | null)?.evidence_path,
    ...(parsed.member.education as { evidence_path?: string | null }[]).map((e) => e.evidence_path)].filter(Boolean) as string[];
  if (paths.some((p) => !p.startsWith('applications/'))) return { error: 'ፋይሉ ትክክል አይደለም። እንደገና ይጫኑ።' };

  const admin = createAdminClient();
  const [{ data: same }, { data: pending }] = await Promise.all([
    admin.from('members').select('id').eq('is_active', true).ilike('full_name', parsed.fullName).limit(1),
    admin.from('member_applications').select('id').eq('status', 'pending').ilike('full_name', parsed.fullName).limit(1),
  ]);
  if (same?.length) return { error: DUPLICATE_NAME_MSG };
  if (pending?.length) return { error: 'በዚህ ስም ማመልከቻ ቀደም ብሎ ቀርቧል። የሰው ሃብት አስተዳደር እስኪያጸድቀው ይጠብቁ።' };

  // Reserve the registration number now; the login is created but only works after HR approves.
  const { data: key, error: kErr } = await admin.rpc('new_application_key', { p_seed: parsed.fullName });
  const { data: password, error: pErr } = key ? await admin.rpc('member_password', { p_reg_key: key, p_pin: pin }) : { data: null, error: kErr };
  if (!key || !password || pErr) return { error: 'መላክ አልተቻለም። እንደገና ይሞክሩ።' };
  const { data: user, error: uErr } = await admin.auth.admin.createUser({
    email: `${String(key).toLowerCase()}@${MEMBER_EMAIL_DOMAIN}`, password: String(password), email_confirm: true,
    user_metadata: { member: true },
  });
  if (uErr || !user.user) return { error: 'መላክ አልተቻለም። እንደገና ይሞክሩ።' };

  const { data: row, error } = await admin.from('member_applications').insert({
    data: parsed.member, depts: parsed.depts, full_name: parsed.fullName, phone: parsed.phone,
    reg_key: key, auth_user_id: user.user.id,
  }).select('id, reg_no').single();
  if (error || !row) {
    await admin.auth.admin.deleteUser(user.user.id);
    return { error: 'መላክ አልተቻለም። እንደገና ይሞክሩ።' };
  }
  return { ok: 'ተመዝግበዋል።', appId: row.id, regNo: row.reg_no };
}

/** HR: reject a pending application with a reason. */
export async function rejectApplication(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireDept('hr');
  const id = String(fd.get('id') ?? '');
  const reason = String(fd.get('reason') ?? '').trim();
  if (reason.length < 3) return { error: 'ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from('member_applications').update({
    status: 'rejected', reject_reason: reason, decided_by: staff.userId, decided_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'pending').select('auth_user_id');
  if (error || !rows?.length) return { error: 'አልተሳካም።' };
  // The login reserved at registration is removed.
  if (rows[0].auth_user_id) await createAdminClient().auth.admin.deleteUser(rows[0].auth_user_id);
  revalidatePath('/staff/hr/applications');
  return { ok: 'ውድቅ ተደርጓል።' };
}

/** HR: open / close public registration. */
export async function setRegistration(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('hr');
  const open = fd.get('open') === 'on';
  const until = String(fd.get('until') ?? '').trim() || null;
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: 'ቀኑ ትክክል አይደለም።' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_registration', { p_open: open, p_until: until });
  if (error) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath('/', 'layout');
  return { ok: open ? 'ምዝገባው ለሕዝብ ተከፍቷል።' : 'ምዝገባው ተዘግቷል።' };
}
