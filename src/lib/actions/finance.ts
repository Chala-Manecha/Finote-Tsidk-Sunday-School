'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const refresh = () => revalidatePath('/staff', 'layout');

/** ሒሳብና ንብረት: the cash the Sunday school held when tracking started. */
export async function setOpeningBalance(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const amount = Number(text(fd, 'opening_balance').replace(/,/g, ''));
  const asOf = text(fd, 'as_of');
  if (!Number.isFinite(amount) || amount < 0) return { error: 'ትክክለኛ መጠን ያስገቡ።' };
  if (!DATE_RE.test(asOf)) return { error: 'ቀን ይምረጡ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('wallet_settings')
    .update({ opening_balance: amount, as_of: asOf, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', true);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

/** ሒሳብና ንብረት: property log entry (added / maintained / lost). */
