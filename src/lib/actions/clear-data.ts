'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FormState } from '@/components/media-form';

/** Before real data: remove the sample members and/or the sample money records. */
export async function clearSampleData(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const members = fd.get('members') === 'on';
  const money = fd.get('money') === 'on';
  if (!members && !money) return { error: 'የሚጸዳውን ይምረጡ።' };
  if (members && !canAccess(staff, 'office')) return { error: 'አባላትን የሚያጸዳው ጽሕፈት ቤት ነው።' };
  if (money && !canAccess(staff, 'finance')) return { error: 'የገንዘብ መረጃን የሚያጸዳው ሒሳብና ንብረት ነው።' };
  if (String(fd.get('confirm') ?? '').trim() !== 'አጽዳ') return { error: 'ለማረጋገጥ “አጽዳ” ብለው ይጻፉ።' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('clear_sample_data', { p_members: members, p_money: money });
  if (error) return { error: error.message.includes('permission') ? 'ፈቃድ የለዎትም።' : `አልተሳካም፦ ${error.message}` };
  const r = (data ?? {}) as { members?: number; applications?: number; requests?: number; earnings?: number; donations?: number; receipts?: number; users?: string[] };

  // the sample members' logins
  let removed = 0;
  if (r.users?.length) {
    const admin = createAdminClient();
    for (const id of r.users) { const { error: e } = await admin.auth.admin.deleteUser(id); if (!e) removed++; }
  }
  revalidatePath('/', 'layout');
  const parts: string[] = [];
  if (members) parts.push(`${r.members ?? 0} አባላት`, `${r.applications ?? 0} ማመልከቻዎች`, `${removed} የመግቢያ አካውንቶች`);
  if (money) parts.push(`${r.requests ?? 0} የወጪ ጥያቄዎች`, `${r.earnings ?? 0} ገቢዎች`, `${r.donations ?? 0} እርዳታዎች`, `${r.receipts ?? 0} ደረሰኞች`);
  return { ok: `✓ ተጠርጓል፦ ${parts.join(' · ')}` };
}
