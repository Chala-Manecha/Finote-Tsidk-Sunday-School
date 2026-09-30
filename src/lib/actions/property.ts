'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ITEM_CONDITION, isDeptCode } from '@/lib/constants';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string) => {
  const v = text(fd, k).replace(/,/g, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const refresh = () => revalidatePath('/staff', 'layout');

/** ንብረት: ጽሕፈት ቤት for any dept, ሒሳብና ንብረት for its own (RLS enforces). */
export async function saveProperty(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const name = text(fd, 'name');
  const owner_dept = text(fd, 'owner_dept');
  const condition = text(fd, 'condition');
  const qty = num(fd, 'qty');
  const price = num(fd, 'price');
  if (!name) return { error: 'የዕቃውን ስም ያስገቡ።' };
  if (!isDeptCode(owner_dept)) return { error: 'ክፍል ይምረጡ።' };
  if (!(condition in ITEM_CONDITION)) return { error: 'ሁኔታ ይምረጡ።' };
  if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty)) return { error: 'ብዛት ያስገቡ።' };
  if (Number.isNaN(price)) return { error: 'ዋጋ ትክክል አይደለም።' };
  const row = { name, owner_dept, condition, qty, price };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('dept_property').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('dept_property').insert(row, { count: 'exact' });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}
export async function deleteProperty(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('dept_property').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** የሽያጭ ዕቃዎች — ልማትና በጎ አድራጎት's shop stock. */
export async function saveSaleItem(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const name = text(fd, 'name');
  const qty = num(fd, 'qty');
  const price = num(fd, 'price');
  if (!name) return { error: 'የዕቃውን ስም ያስገቡ።' };
  if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty)) return { error: 'ብዛት ያስገቡ።' };
  if (Number.isNaN(price)) return { error: 'ዋጋ ትክክል አይደለም።' };
  const supabase = await createClient();
  const row = { name, qty, price };
  const { error, count } = id
    ? await supabase.from('sale_items').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('sale_items').insert(row, { count: 'exact' });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}
export async function deleteSaleItem(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('sale_items').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
