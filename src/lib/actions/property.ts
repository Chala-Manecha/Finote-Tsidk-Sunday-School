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
  const rawImg = text(fd, 'image_path');
  const image_path = rawImg.startsWith('shop/') ? rawImg : undefined;
  const row = { name, qty, price, description: text(fd, 'description') || null, ...(image_path ? { image_path } : {}) };
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

/** ልማትና በጎ አድራጎት: the contact shown on the public ለመግዛት page. */
export async function saveShopSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const phone = text(fd, 'phone') || null;
  const telegram = text(fd, 'telegram').replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '') || null;
  if (telegram && !/^[A-Za-z0-9_]{4,32}$/.test(telegram)) return { error: 'የTelegram username ትክክል አይደለም።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('shop_settings')
    .update({ phone, telegram }, { count: 'exact' }).eq('id', true);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  revalidatePath('/shop');
  return { ok: 'ተቀምጧል።' };
}

/** A sale becomes a ገቢ report; stock drops when ሒሳብና ንብረት approves it. */
export async function recordSale(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const sale_item_id = text(fd, 'sale_item_id');
  const sale_qty = Number(text(fd, 'sale_qty'));
  const earned_on = text(fd, 'earned_on');
  if (!/^[0-9a-f-]{36}$/i.test(sale_item_id)) return { error: 'ዕቃ ይምረጡ።' };
  if (!Number.isInteger(sale_qty) || sale_qty < 1) return { error: 'ብዛት ትክክል አይደለም።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(earned_on)) return { error: 'ቀን ይምረጡ።' };
  const supabase = await createClient();
  const { data: item } = await supabase.from('sale_items').select('name, qty, price').eq('id', sale_item_id).maybeSingle();
  if (!item) return { error: 'ዕቃው አልተገኘም።' };
  if (sale_qty > item.qty) return { error: `በክምችት ያለው ${item.qty} ብቻ ነው።` };
  const typed = Number(text(fd, 'amount').replace(/,/g, ''));
  const amount = typed > 0 ? typed : Number(item.price ?? 0) * sale_qty;
  if (!(amount > 0)) return { error: 'ጠቅላላ የሽያጭ ገንዘብ ያስገቡ።' };
  const { error } = await supabase.from('earnings').insert({
    dept: 'development', amount, earned_on, submitted_by: staff.userId,
    source: `ሽያጭ፦ ${item.name} × ${sale_qty}`, sale_item_id, sale_qty,
  });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  refresh();
  return { ok: 'ሽያጩ እንደ ገቢ ለሒሳብና ንብረት ተልኳል። ሲጸድቅ ክምችቱ ይቀንሳል።' };
}
