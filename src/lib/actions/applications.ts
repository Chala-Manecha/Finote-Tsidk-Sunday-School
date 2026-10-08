'use server';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMemberForm, DUPLICATE_NAME_MSG } from '@/lib/member-parse';
import type { FormState } from '@/components/media-form';

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
export async function submitApplication(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await isOpen())) return { error: 'ምዝገባው ለጊዜው ተዘግቷል። እባክዎ ቢሮ ቁጥር 9 በአካል ይምጡ።' };
  for (const k of ['id', 'application_id']) fd.delete(k);
  const parsed = parseMemberForm(fd, true);
  if ('error' in parsed) return { error: parsed.error };
  if (!parsed.phone) return { error: 'ስልክ ቁጥር ያስገቡ።' };
  const paths = [parsed.member.photo_path, (parsed.member.prior_school as { evidence_path?: string } | null)?.evidence_path,
    (parsed.member.secular_school as { evidence_path?: string } | null)?.evidence_path].filter(Boolean) as string[];
  if (paths.some((p) => !p.startsWith('applications/'))) return { error: 'ፋይሉ ትክክል አይደለም። እንደገና ይጫኑ።' };

  const admin = createAdminClient();
  const [{ data: same }, { data: pending }] = await Promise.all([
    admin.from('members').select('id').eq('is_active', true).ilike('full_name', parsed.fullName).limit(1),
    admin.from('member_applications').select('id').eq('status', 'pending').ilike('full_name', parsed.fullName).limit(1),
  ]);
  if (same?.length) return { error: DUPLICATE_NAME_MSG };
  if (pending?.length) return { error: 'በዚህ ስም ማመልከቻ ቀደም ብሎ ቀርቧል። የሰው ሃብት አስተዳደር እስኪያጸድቀው ይጠብቁ።' };

  const { error } = await admin.from('member_applications').insert({
    data: parsed.member, depts: parsed.depts, full_name: parsed.fullName, phone: parsed.phone,
  });
  if (error) return { error: 'መላክ አልተቻለም። እንደገና ይሞክሩ።' };
  return { ok: 'የሰው ሃብት አስተዳደር መረጃዎን አረጋግጦ ሲያጸድቀው የምዝገባ መለያ ቁጥርዎን በስልክዎ ወይም በቢሮ ቁጥር 9 ያገኛሉ።' };
}

/** HR: reject a pending application with a reason. */
export async function rejectApplication(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireDept('hr');
  const id = String(fd.get('id') ?? '');
  const reason = String(fd.get('reason') ?? '').trim();
  if (reason.length < 3) return { error: 'ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('member_applications').update({
    status: 'rejected', reject_reason: reason, decided_by: staff.userId, decided_at: new Date().toISOString(),
  }, { count: 'exact' }).eq('id', id).eq('status', 'pending');
  if (error || !count) return { error: 'አልተሳካም።' };
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
