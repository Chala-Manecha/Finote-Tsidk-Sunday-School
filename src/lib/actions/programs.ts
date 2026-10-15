'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PROGRAMS, isProgram } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** The department adds members who chose its program (they then appear on its attendance list). */
export async function addToProgram(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const program = String(fd.get('program') ?? '');
  if (!isProgram(program) || !canAccess(staff, PROGRAMS[program].dept)) return { error: 'ፈቃድ የለዎትም።' };
  const ids = fd.getAll('ids').map(String).filter((x) => UUID_RE.test(x));
  if (ids.length === 0) return { error: 'መጀመሪያ አባላትን ይምረጡ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('member_programs').update({ status: 'active' }, { count: 'exact' })
    .eq('program', program).eq('status', 'chosen').in('member_id', ids);
  if (error) return { error: error.message };
  // ኮርስ: also put them in this year's list (class is assigned under ክፍሎችና ተማሪዎች).
  if (program === 'course') {
    const { data: year } = await supabase.from('academic_years').select('id').eq('is_active', true).maybeSingle();
    if (year) {
      await supabase.from('enrollments').upsert(ids.map((member_id) => ({ year_id: year.id, member_id })),
        { onConflict: 'year_id,member_id', ignoreDuplicates: true });
    }
  }
  revalidatePath('/staff', 'layout');
  return { ok: `${count ?? 0} አባላት ተጨምረዋል።` };
}

/** Move a member back to “waiting” (e.g. added by mistake). Declining is ሰው ሃብት's decision with the member. */
export async function returnToWaiting(program: string, memberId: string) {
  const staff = await requireStaff();
  if (!isProgram(program) || !canAccess(staff, PROGRAMS[program].dept)) return { error: 'ፈቃድ የለዎትም።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('member_programs').update({ status: 'chosen' }, { count: 'exact' })
    .eq('program', program).eq('member_id', memberId).eq('status', 'active');
  if (error) return { error: error.message };
  if (!count) return { error: 'መቀየር አልተቻለም።' };
  revalidatePath('/staff', 'layout');
}
