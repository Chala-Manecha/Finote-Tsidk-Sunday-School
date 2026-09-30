'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DUTIES, DUTY_DEPTS, OCCASIONS } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };

const refresh = () => {
  revalidatePath('/staff', 'layout');
  revalidatePath('/roster');
};

/** Add or edit a duty assignment for one of the 4 contributing departments. */
export async function saveDuty(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = String(fd.get('id') ?? '') || null;
  const dept = String(fd.get('dept') ?? '');
  const memberId = String(fd.get('member_id') ?? '');
  const duty = String(fd.get('duty') ?? '');
  const occasion = String(fd.get('occasion') ?? '');
  const dutyDate = String(fd.get('duty_date') ?? '');

  if (!(DUTY_DEPTS as readonly string[]).includes(dept) || !canAccess(staff, dept)) return { error: 'ፈቃድ የለዎትም።' };
  if (!memberId) return { error: 'አባል ይምረጡ።' };
  if (!(DUTIES as readonly string[]).includes(duty)) return { error: 'ምድብ ይምረጡ።' };
  if (!(OCCASIONS as readonly string[]).includes(occasion)) return { error: 'ምክንያት ይምረጡ።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dutyDate)) return { error: 'ቀን ይምረጡ።' };

  const row = { member_id: memberId, dept, duty, occasion, duty_date: dutyDate };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('duty_assignments').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('duty_assignments').insert(row, { count: 'exact' });
  if (error) return { error: error.message };
  if (!count) return { error: 'ማስቀመጥ አልተቻለም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ምደባ ተጨምሯል።' };
}

export async function deleteDuty(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('duty_assignments').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ማጥፋት አልተቻለም።' };
  refresh();
}
