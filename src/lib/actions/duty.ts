'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DUTIES, DUTY_DEPTS } from '@/lib/constants';
import { requireMember } from '@/lib/member-auth';

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
  const pick = String(fd.get('duty') ?? '');
  const duty = pick === 'other' ? String(fd.get('duty_other') ?? '').trim().slice(0, 80) : pick;
  const occasion = String(fd.get('occasion') ?? '');
  const dutyDate = String(fd.get('duty_date') ?? '');

  if (!(DUTY_DEPTS as readonly string[]).includes(dept) || !canAccess(staff, dept)) return { error: 'ፈቃድ የለዎትም።' };
  if (!memberId) return { error: 'አባል ይምረጡ።' };
  if (!duty || (pick !== 'other' && !(DUTIES as readonly string[]).includes(duty))) return { error: 'ምድብ ይምረጡ ወይም ይጻፉ።' };
  if (!occasion || occasion.length > 80) return { error: 'በአል ይምረጡ።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dutyDate)) return { error: 'ቀን ይምረጡ።' };

  const row = { member_id: memberId, dept, duty, occasion, duty_date: dutyDate };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('duty_assignments').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('duty_assignments').insert(row, { count: 'exact' });
  if (error) return { error: error.message.includes('duty_locked') ? 'አባሉ ምደባውን ስለተቀበለ መቀየር አይቻልም።' : error.message };
  if (!count) return { error: 'ማስቀመጥ አልተቻለም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተመድቧል — አባሉ ከቀኑ በፊት ሲቀበል ይጸድቃል።' };
}

export async function deleteDuty(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('duty_assignments').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ማጥፋት አልተቻለም።' };
  refresh();
}

/** The assigning department confirms whether the member did the job (null = back to “not confirmed”). */
export async function confirmDuty(id: string, status: 'done' | 'missed' | null) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('duty_assignments').update({ status }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message.includes('duty_not_accepted') ? 'አባሉ ያልተቀበለውን ምደባ ማረጋገጥ አይቻልም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

// ---------- the member's side ----------
/** The member accepts a job a department gave them (before the day; final). */
export async function acceptDuty(id: string) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_duty', { p_id: id });
  if (error) return { error: error.message.includes('duty_expired') ? 'ቀኑ አልፏል።' : 'መቀበል አልተቻለም።' };
  revalidatePath('/student');
  refresh();
}

/** The member offers to do a job (ምድብ, በአል, ቀን) — cannot be changed once sent. */
export async function chooseDuty(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const pick = String(fd.get('duty') ?? '');
  const duty = pick === 'other' ? String(fd.get('duty_other') ?? '').trim() : pick;
  const occasion = String(fd.get('occasion') ?? '');
  const date = String(fd.get('duty_date') ?? '');
  if (!duty) return { error: 'ምድብ ይምረጡ ወይም ይጻፉ።' };
  if (!occasion) return { error: 'በአል ይምረጡ።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'ቀን ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('choose_duty', { p_duty: duty, p_occasion: occasion, p_date: date });
  if (error) return { error: error.message.includes('duty_date') ? 'ያለፈ ቀን መምረጥ አይቻልም።' : 'መላክ አልተቻለም።' };
  revalidatePath('/student');
  refresh();
  return { ok: 'ተመዝግቧል። እግዚአብሔር ይስጥልን።' };
}
