import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MoneyStatus } from '@/lib/constants';

export type RequestRow = {
  id: string;
  dept: string;
  amount: number;
  reason: string;
  needed_by: string | null;
  status: MoneyStatus;
  audit_flag: boolean;
  audit_note: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  spent: number;
  refund: number;          // ተመላሽ
  self_contributed: number; // ከራስ ወጪ
  lines: { id: string; amount: number; reason: string; spent_on: string }[];
};

/** Money requests the caller may see (RLS), with computed spend totals and lines. */
export async function fetchRequests(
  supabase: SupabaseClient,
  opts: { dept?: string; statuses?: MoneyStatus[] } = {},
): Promise<RequestRow[]> {
  let q = supabase
    .from('money_requests')
    .select('id, dept, amount, reason, needed_by, status, audit_flag, audit_note, requested_at, decided_at, paid_at, expense_lines(id, amount, reason, spent_on)')
    .order('requested_at', { ascending: false });
  if (opts.dept) q = q.eq('dept', opts.dept);
  if (opts.statuses) q = q.in('status', opts.statuses);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const lines = (r.expense_lines ?? []).map((l: { id: string; amount: number | string; reason: string; spent_on: string }) => ({
      ...l, amount: Number(l.amount),
    }));
    const amount = Number(r.amount);
    const spent = lines.reduce((s: number, l: { amount: number }) => s + l.amount, 0);
    // Same formula as the money_request_totals view: never stored, always computed.
    return {
      ...r,
      amount,
      lines: lines.sort((a: { spent_on: string }, b: { spent_on: string }) => a.spent_on.localeCompare(b.spent_on)),
      spent,
      refund: Math.max(amount - spent, 0),
      self_contributed: Math.max(spent - amount, 0),
    } as RequestRow;
  });
}

export type DeptMoneySummary = {
  dept: string;
  approved: number;
  spent: number;
  self_contributed: number;
  refund: number;
  earned: number;
};

/** Per-department roll-up for ሒሳብና ንብረት's የገንዘብ ክትትል and ኦዲት's የክፍላት አስተዋጽኦ. */
export async function fetchDeptSummaries(supabase: SupabaseClient): Promise<{
  rows: DeptMoneySummary[];
  requests: RequestRow[];
}> {
  const requests = await fetchRequests(supabase, { statuses: ['approved', 'paid'] });
  const { data: earnings, error } = await supabase
    .from('earnings')
    .select('dept, amount')
    .eq('status', 'approved');
  if (error) throw new Error(error.message);

  const map = new Map<string, DeptMoneySummary>();
  const get = (dept: string) => {
    let row = map.get(dept);
    if (!row) {
      row = { dept, approved: 0, spent: 0, self_contributed: 0, refund: 0, earned: 0 };
      map.set(dept, row);
    }
    return row;
  };
  for (const r of requests) {
    const row = get(r.dept);
    row.approved += r.amount;
    row.spent += r.spent;
    row.self_contributed += r.self_contributed;
    row.refund += r.refund;
  }
  for (const e of earnings ?? []) get(e.dept).earned += Number(e.amount);
  return { rows: [...map.values()], requests };
}
