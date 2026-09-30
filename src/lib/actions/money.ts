'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const amountOf = (fd: FormData) => {
  const n = Number(String(fd.get('amount') ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const refresh = () => revalidatePath('/staff', 'layout');

// Database triggers enforce who may make each status change; these
// actions just shape the data and surface errors.

// ---------- requesting department ----------

export async function requestMoney(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const dept = text(fd, 'dept');
  if (!isDeptCode(dept) || !canAccess(staff, dept)) return { error: 'ፈቃድ የለዎትም።' };
  const amount = amountOf(fd);
  const reason = text(fd, 'reason');
  const neededBy = text(fd, 'needed_by');
  if (!amount) return { error: 'ትክክለኛ የገንዘብ መጠን ያስገቡ።' };
  if (!reason) return { error: 'ምክንያት ያስገቡ።' };
  if (neededBy && !DATE_RE.test(neededBy)) return { error: 'ቀን ትክክል አይደለም።' };

  const supabase = await createClient();
  const { error } = await supabase.from('money_requests').insert({
    dept, amount, reason, needed_by: neededBy || null, requested_by: staff.userId,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: 'ጥያቄው ለጽሕፈት ቤት ተልኳል።' };
}

export async function withdrawRequest(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from('money_requests').update({ status: 'withdrawn' }).eq('id', id);
  if (error) return { error: error.message };
  refresh();
}

export async function addExpense(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const requestId = text(fd, 'request_id');
  const amount = amountOf(fd);
  const reason = text(fd, 'reason');
  const spentOn = text(fd, 'spent_on');
  if (!amount) return { error: 'ትክክለኛ የወጣ መጠን ያስገቡ።' };
  if (!reason) return { error: 'የወጣበትን ምክንያት ያስገቡ።' };
  if (!DATE_RE.test(spentOn)) return { error: 'ቀን ይምረጡ።' };

  const supabase = await createClient();
  const { error } = await supabase.from('expense_lines').insert({
    request_id: requestId, amount, reason, spent_on: spentOn,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: 'ወጪ ተመዝግቧል።' };
}

export async function deleteExpense(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('expense_lines').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ማጥፋት አልተቻለም።' };
  refresh();
}

export async function reportEarning(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const dept = text(fd, 'dept');
  if (!isDeptCode(dept) || !canAccess(staff, dept)) return { error: 'ፈቃድ የለዎትም።' };
  const amount = amountOf(fd);
  const source = text(fd, 'source');
  const earnedOn = text(fd, 'earned_on');
  if (!amount) return { error: 'ትክክለኛ መጠን ያስገቡ።' };
  if (!source) return { error: 'የገቢውን ምንጭ ያስገቡ።' };
  if (!DATE_RE.test(earnedOn)) return { error: 'ቀን ይምረጡ።' };

  const supabase = await createClient();
  const { error } = await supabase.from('earnings').insert({
    dept, amount, source, earned_on: earnedOn, submitted_by: staff.userId,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: 'ገቢው ለሒሳብና ንብረት ተልኳል።' };
}

export async function deleteEarning(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('earnings').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ማጥፋት አልተቻለም።' };
  refresh();
}

// ---------- approvers ----------

/** ጽሕፈት ቤት */
export async function decideRequest(id: string, status: 'approved' | 'rejected') {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('money_requests').update({ status }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** ሒሳብና ንብረት */
export async function markPaid(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('money_requests').update({ status: 'paid' }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** ሒሳብና ንብረት */
export async function decideEarning(id: string, status: 'approved' | 'rejected') {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('earnings').update({ status }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** ኦዲት እና ምርመራ */
export async function flagRequest(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id');
  const flag = fd.get('audit_flag') === 'on';
  const note = text(fd, 'audit_note') || null;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('money_requests')
    .update({ audit_flag: flag, audit_note: note }, { count: 'exact' })
    .eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

/** ሒሳብና ንብረት approves a department's spend report — its lines lock after this. */
export async function approveSpend(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('money_requests')
    .update({ spend_approved_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id);
  if (error) return { error: error.message.includes('only') ? 'ፈቃድ የለዎትም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
