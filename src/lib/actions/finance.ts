'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';
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
export async function savePropertyLog(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const dept = text(fd, 'dept');
  const kind = text(fd, 'kind');
  const item_name = text(fd, 'item_name');
  const qty = Number(text(fd, 'qty') || '1');
  const value = Number(text(fd, 'value').replace(/,/g, '') || '0');
  const log_date = text(fd, 'log_date');
  if (!isDeptCode(dept)) return { error: 'ክፍል ይምረጡ።' };
  if (!['added', 'maintained', 'lost'].includes(kind)) return { error: 'አይነት ይምረጡ።' };
  if (!item_name) return { error: 'የዕቃውን ስም ያስገቡ።' };
  if (!Number.isInteger(qty) || qty < 1) return { error: 'ብዛት ትክክል አይደለም።' };
  if (!Number.isFinite(value) || value < 0) return { error: 'ዋጋ ትክክል አይደለም።' };
  if (!DATE_RE.test(log_date)) return { error: 'ቀን ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('property_log').insert({
    dept, kind, item_name, qty, value, log_date, note: text(fd, 'note') || null,
  });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  refresh();
  return { ok: 'ተመዝግቧል።' };
}

export async function deletePropertyLog(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('property_log').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
