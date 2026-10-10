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
  spend_approved_at: string | null;
  term_id: string | null;
  pay_method: string | null;
  pay_reference: string | null;
  voucher_no: string | null;
  received_at: string | null;
  received_name: string | null;
  audited_at: string | null;
  auto_audited?: boolean;
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
    .select('id, dept, amount, reason, needed_by, status, audit_flag, audit_note, requested_at, decided_at, paid_at, spend_approved_at, term_id, pay_method, pay_reference, voucher_no, received_at, received_name, audited_at, auto_audited, expense_lines(id, amount, reason, spent_on)')
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

/** Where a request stands in the out-money flow (ሒሳብና ንብረት's tracker). */
export function requestStage(r: RequestRow): { label: string; tone: string } {
  if (r.status === 'pending') return { label: 'ጽሕፈት ቤት በመጠባበቅ ላይ', tone: 'half' };
  if (r.status === 'rejected') return { label: 'ተከልክሏል', tone: 'absent' };
  if (r.status === 'withdrawn') return { label: 'ተሰርዟል', tone: '' };
  if (r.status === 'approved') return { label: 'ጸድቋል — ክፍያ በመጠባበቅ ላይ', tone: 'half' };
  if (!r.received_at) return { label: 'ተከፍሏል — የክፍሉ ፊርማ በመጠባበቅ ላይ', tone: 'half' };
  if (!r.spend_approved_at) return { label: 'ተረክቧል — ወጪ ሪፖርት በመጠባበቅ ላይ', tone: 'half' };
  return { label: 'ተዘግቷል', tone: 'present' };
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
