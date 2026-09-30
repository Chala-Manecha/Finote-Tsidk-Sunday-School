'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };

/** Public: a registered member (picked from the list) sends feedback to a department. */
export async function submitFeedback(_: FormState, fd: FormData): Promise<FormState> {
  const member_id = String(fd.get('member_id') ?? '');
  const dept = String(fd.get('dept') ?? '');
  const message = String(fd.get('message') ?? '').trim();
  const contact = String(fd.get('contact') ?? '').trim().replace(/^@/, '') || null;
  if (!/^[0-9a-f-]{36}$/i.test(member_id)) return { error: 'ስምዎትን ከዝርዝሩ ይምረጡ።' };
  if (!isDeptCode(dept)) return { error: 'ክፍል ይምረጡ።' };
  if (message.length < 3) return { error: 'አስተያየትዎትን ይጻፉ።' };
  if (message.length > 4000) return { error: 'አስተያየቱ በጣም ረጅም ነው።' };

  const supabase = await createClient();
  // No .select(): anonymous visitors may insert but not read feedback back.
  const { error } = await supabase.from('feedback').insert({ member_id, dept, message, contact });
  if (error) return { error: 'መላክ አልተቻለም። እባክዎ ቆይተው ይሞክሩ።' };
  revalidatePath('/staff', 'layout');
  return { ok: 'አስተያየትዎ ተልኳል። እናመሰግናለን!' };
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
