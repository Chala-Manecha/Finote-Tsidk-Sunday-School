'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, isDeptCode } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };

/** Public: a registered member (registration ID + Telegram) sends feedback to a department. */
export async function submitFeedback(_: FormState, fd: FormData): Promise<FormState> {
  const reg_no = String(fd.get('reg_no') ?? '').trim();
  const telegram = String(fd.get('telegram') ?? '').trim();
  const dept = String(fd.get('dept') ?? '');
  const message = String(fd.get('message') ?? '').trim();
  if (!/\d/.test(reg_no)) return { error: 'የመመዝገቢያ ቁጥርዎን ያስገቡ (ለምሳሌ ፍጽ-0001)።' };
  if (!isDeptCode(dept)) return { error: 'ክፍል ይምረጡ።' };
  if (message.length < 3) return { error: 'አስተያየትዎትን ይጻፉ።' };
  if (message.length > 4000) return { error: 'አስተያየቱ በጣም ረጅም ነው።' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_feedback', {
    p_reg_no: reg_no, p_telegram: telegram, p_dept: dept, p_message: message,
  });
  if (error) return { error: 'መላክ አልተቻለም። እባክዎ ቆይተው ይሞክሩ።' };
  switch (data) {
    case 'ok':
      revalidatePath('/staff', 'layout');
      return { ok: `እግዚአብሔር ይስጥልን። መልእክትዎ ወደ ${DEPT_NAME[dept]} በተሳካ ሁኔታ ተልኳል።` };
    case 'mismatch':
      return { error: 'እባክዎ ሲመዘገቡ ባስገቡት መሰረት በትክክል ያስገቡ።' };
    case 'not_found':
      return { error: 'እባክዎ በቅድሚያ ወደ ቢሮ ቁጥር 9 በመሄድ ይመዝገቡ!' };
    default:
      return { error: 'መረጃው ትክክል አይደለም።' };
  }
}

/** Tagged department marks feedback as seen (ታይቷል) after replying on Telegram. */
export async function markFeedbackSeen(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('feedback').update({ status: 'seen' }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath('/staff', 'layout');
}
