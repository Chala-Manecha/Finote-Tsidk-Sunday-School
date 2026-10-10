'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ITEM_CONDITION, isDeptCode } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string) => {
  const v = text(fd, k).replace(/,/g, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const refresh = () => revalidatePath('/staff', 'layout');

/** ንብረት: ሒሳብና ንብረት registers and edits every department's property (RLS enforces). */
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
  const registered_on = text(fd, 'registered_on');
  const source = text(fd, 'source');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registered_on)) return { error: 'የተመዘገበበትን ቀን ይምረጡ።' };
  if (!source) return { error: 'ምንጩን ይምረጡ።' };
  const row = { name, owner_dept, condition, qty, price, note: text(fd, 'note') || null, registered_on, source };
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

/** A department asks ሒሳብና ንብረት to approve something it bought (አዲስ የተገዛ ንብረት ለማጸደቅ). */
export async function requestProperty(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const dept = text(fd, 'owner_dept');
  const name = text(fd, 'name');
  const condition = text(fd, 'condition');
  const qty = num(fd, 'qty');
  const price = num(fd, 'price');
  const registered_on = text(fd, 'registered_on');
  const source = text(fd, 'source');
  if (!isDeptCode(dept)) return { error: 'ክፍል ይምረጡ።' };
  if (!name) return { error: 'የዕቃውን ስም ያስገቡ።' };
  if (!(condition in ITEM_CONDITION)) return { error: 'ሁኔታ ይምረጡ።' };
  if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty) || qty < 1) return { error: 'ብዛት ያስገቡ።' };
  if (Number.isNaN(price)) return { error: 'ዋጋ ትክክል አይደለም።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registered_on)) return { error: 'የተመዘገበበትን ቀን ይምረጡ።' };
  if (!source) return { error: 'ምንጩን ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('property_requests').insert({
    dept, name, condition, qty, price, registered_on, source, note: text(fd, 'note') || null,
  });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  refresh();
  return { ok: 'ለሒሳብና ንብረት ለማጸደቅ ተልኳል።' };
}
export async function withdrawPropertyRequest(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('property_requests').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
export async function approvePropertyRequest(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_property_request', { p_id: id });
  if (error) return { error: error.message.includes('only') ? 'ፈቃድ የለዎትም።' : error.message.includes('pending') ? 'ቀድሞ ተወስኗል።' : error.message };
  refresh();
}
export async function rejectPropertyRequest(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const reason = text(fd, 'reason');
  if (reason.length < 3) return { error: 'ምክንያቱን ይጻፉ።' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_property_request', { p_id: text(fd, 'id'), p_reason: reason });
  if (error) return { error: error.message.includes('only') ? 'ፈቃድ የለዎትም።' : error.message.includes('pending') ? 'ቀድሞ ተወስኗል።' : error.message };
  refresh();
  return { ok: 'ተመልሷል።' };
}

/** የተገዙ ዕቃዎች መዝገብ — ልማትና በጎ አድራጎት records what was bought (the sell price is set when published). */
export async function saveSaleItem(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const name = text(fd, 'name');
  const qty = num(fd, 'qty');
  const buy_price = num(fd, 'buy_price');
  const price = num(fd, 'price');
  const bought_on = text(fd, 'bought_on');
  if (!name) return { error: 'የዕቃውን ስም ያስገቡ።' };
  if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty) || qty < 1) return { error: 'ብዛት ያስገቡ።' };
  if (buy_price === null || Number.isNaN(buy_price)) return { error: 'የተገዛበትን ዋጋ ያስገቡ።' };
  if (Number.isNaN(price)) return { error: 'የመሸጫ ዋጋ ትክክል አይደለም።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bought_on)) return { error: 'የተገዛበትን ቀን ይምረጡ።' };
  const supabase = await createClient();
  const rawImg = text(fd, 'image_path');
  const image_path = rawImg.startsWith('shop/') ? rawImg : undefined;
  const rawImg2 = text(fd, 'image2_path');
  const image2_path = rawImg2.startsWith('shop/') ? rawImg2 : fd.get('remove_image2') === 'on' ? null : undefined;
  const row = {
    name, qty, buy_price, bought_on, description: text(fd, 'description') || null,
    ...(price !== null ? { price } : {}),
    ...(image_path ? { image_path } : {}), ...(image2_path !== undefined ? { image2_path } : {}),
  };
  const { error, count } = id
    ? await supabase.from('sale_items').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('sale_items').insert(row, { count: 'exact' });
  if (error) return { error: error.message.includes('sold_le_qty') ? 'ከተሸጠው ያነሰ ብዛት ማስገባት አይቻልም።' : error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  revalidatePath('/shop');
  return { ok: id ? 'ተቀይሯል።' : 'ተመዝግቧል።' };
}

/** Sold button: add the sold quantity (default: all that remain) and stamp today's date. */
export async function markSold(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id');
  const n = num(fd, 'sold');
  if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 1) return { error: 'ብዛት ያስገቡ።' };
  const supabase = await createClient();
  const { data: item } = await supabase.from('sale_items').select('qty, sold_qty').eq('id', id).maybeSingle();
  if (!item) return { error: 'ዕቃው አልተገኘም።' };
  if (item.sold_qty + n > item.qty) return { error: `የቀረው ${item.qty - item.sold_qty} ብቻ ነው።` };
  const { error, count } = await supabase.from('sale_items')
    .update({ sold_qty: item.sold_qty + n, sold_on: todayIsoAddis() }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  revalidatePath('/shop');
  return { ok: 'ተሽጧል።' };
}

export async function deleteSaleItem(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('sale_items').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** የሽያጭ ዕቃዎች: put a registered item on the public ለመግዛት page with its sell price. */
export async function publishSaleItem(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id');
  const price = num(fd, 'price');
  if (price === null || Number.isNaN(price) || price < 0) return { error: 'የመሸጫ ዋጋ ያስገቡ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('sale_items').update({ price, published: true }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  revalidatePath('/shop');
  return { ok: 'ለሽያጭ ወጥቷል።' };
}

export async function unpublishSaleItem(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('sale_items').update({ published: false }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  revalidatePath('/shop');
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
