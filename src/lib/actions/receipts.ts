'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const refresh = () => { revalidatePath('/staff', 'layout'); revalidatePath('/donate'); };
const denied = (m: string) => (m.includes('only') || m.includes('row-level') || m.includes('permission') ? 'ፈቃድ የለዎትም።' : m);

// ---------- public ----------

/** Donor claims a transfer to the Sunday school's Telebirr / CBE account. */
export async function submitDonation(_: FormState, fd: FormData): Promise<FormState> {
  const anonymous = fd.get('anonymous') === 'on';
  const name = anonymous ? '' : text(fd, 'donor_name');
  const amount = Number(text(fd, 'amount').replace(/,/g, ''));
  const method = text(fd, 'method');
  const txn = text(fd, 'txn_ref');
  if (!anonymous && name.length < 2) return { error: 'ስምዎን ያስገቡ ወይም “ስሜ አይገለጽ” ይምረጡ።' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'ትክክለኛ የገንዘብ መጠን ያስገቡ።' };
  if (!['telebirr', 'cbe'].includes(method)) return { error: 'የላኩበትን መንገድ ይምረጡ።' };
  if (txn.replace(/[^A-Za-z0-9]/g, '').length < 6) return { error: 'ከመልእክቱ (SMS) ላይ ያለውን የግብይት ቁጥር ያስገቡ።' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_donation', {
    p_name: name, p_phone: text(fd, 'donor_phone'), p_amount: amount, p_method: method,
    p_txn: txn, p_purpose: text(fd, 'purpose'),
  });
  if (error) return { error: 'መላክ አልተቻለም። እባክዎ ቆይተው ይሞክሩ።' };
  if (data === 'duplicate') return { error: 'ይህ የግብይት ቁጥር ቀደም ብሎ ተመዝግቧል። ሁኔታውን “ደረሰኝዎን ይከታተሉ” ላይ ይመልከቱ።' };
  if (data !== 'ok') return { error: 'መረጃው ትክክል አይደለም።' };
  return { ok: 'እግዚአብሔር ይስጥልን። ሒሳብና ንብረት ካረጋገጠ በኋላ ደረሰኝዎን ከቢሮ ቁጥር 10 መውሰድ ይችላሉ።' };
}

// ---------- ሒሳብና ንብረት ----------

export async function saveDonationAccounts(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('donation_accounts').update({
    account_name: text(fd, 'account_name') || null,
    telebirr_number: text(fd, 'telebirr_number') || null,
    cbe_account: text(fd, 'cbe_account') || null,
    updated_at: new Date().toISOString(),
  }, { count: 'exact' }).eq('id', true);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

export async function verifyDonation(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('donations').update({ status: 'verified' }, { count: 'exact' }).eq('id', id);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

export async function rejectDonation(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const reason = text(fd, 'reject_reason');
  if (reason.length < 3) return { error: 'ምክንያቱን ይጻፉ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('donations')
    .update({ status: 'rejected', reject_reason: reason }, { count: 'exact' }).eq('id', text(fd, 'id'));
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተመዝግቧል።' };
}

export async function voidReceipt(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const reason = text(fd, 'void_reason');
  if (reason.length < 3) return { error: 'የመሰረዣ ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('receipts')
    .update({ voided_at: new Date().toISOString(), void_reason: reason }, { count: 'exact' }).eq('id', text(fd, 'id'));
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ደረሰኙ ተሰርዟል።' };
}

export async function reissueReceipt(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc('reissue_receipt', { p_id: id });
  if (error) return { error: denied(error.message) };
  refresh();
}

export async function markReceiptPrinted(id: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.rpc('mark_receipt_printed', { p_id: id });
  refresh();
}

export async function markCertificatePrinted(id: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.rpc('mark_certificate_printed', { p_id: id });
  refresh();
}

// ---------- ኦዲት ----------

export async function auditReceipt(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('receipts')
    .update({ audited_at: new Date().toISOString() }, { count: 'exact' }).eq('id', id);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
