'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FormState } from '@/components/media-form';

/** Before real data (system admin only): remove the sample members, money records and/or education records. */
export async function clearSampleData(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff.isAdmin) return { error: 'ይህን የሚያደርገው የሲስተሙ አስተዳዳሪ ብቻ ነው።' };
  const members = fd.get('members') === 'on';
  const money = fd.get('money') === 'on';
  const education = fd.get('education') === 'on';
  if (!members && !money && !education) return { error: 'የሚጸዳውን ይምረጡ።' };
  if (String(fd.get('confirm') ?? '').trim() !== 'አጽዳ') return { error: 'ለማረጋገጥ “አጽዳ” ብለው ይጻፉ።' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('clear_sample_data', { p_members: members, p_money: money, p_education: education });
  if (error) return { error: error.message.includes('permission') ? 'ፈቃድ የለዎትም።' : `አልተሳካም፦ ${error.message}` };
  const r = (data ?? {}) as Record<string, number | string[] | undefined> & { users?: string[] };

  // the sample members' logins
  let removed = 0;
  if (r.users?.length) {
    const admin = createAdminClient();
    for (const id of r.users) { const { error: e } = await admin.auth.admin.deleteUser(id); if (!e) removed++; }
  }
  revalidatePath('/', 'layout');
  const n = (k: string) => Number(r[k] ?? 0);
  const parts: string[] = [];
  if (members) parts.push(`${n('members')} አባላት`, `${n('applications')} ማመልከቻዎች`, `${removed} የመግቢያ አካውንቶች`);
  if (money) parts.push(`${n('requests')} የወጪ ጥያቄዎች`, `${n('earnings')} ገቢዎች`, `${n('donations')} እርዳታዎች`, `${n('receipts')} ደረሰኞች`);
  if (education) parts.push(`${n('years')} የትምህርት ዘመናት (ከሴሚስተር፣ ኮርስና ውጤት ጋር)`, `${n('abnet')} የአብነት ትምህርቶች`);
  return { ok: `✓ ተጠርጓል፦ ${parts.join(' · ')}` };
}
