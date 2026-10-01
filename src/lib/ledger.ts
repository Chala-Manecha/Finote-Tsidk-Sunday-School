import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchRequests } from '@/lib/money-data';

/**
 * Sunday-school wallet.
 *   balance = opening balance
 *           + approved ገቢ (by earned_on)
 *           − requests paid out (by paid_at)
 *           + ተመላሽ returned (when ሒሳብና ንብረት approves the spend report)
 * ከራስ ወጪ is money a department spent from its own pocket — it never
 * touched the wallet, so it counts toward the department's contribution
 * but not the balance.
 */
export type Movement = {
  date: string;           // YYYY-MM-DD
  dept: string;
  kind: 'income' | 'paid' | 'refund';
  description: string;
  amount: number;         // always positive; direction from `kind`
};

export async function loadWallet(supabase: SupabaseClient) {
  const [{ data: w }, { data: earnings }, { data: gifts }, requests] = await Promise.all([
    supabase.from('wallet_settings').select('opening_balance, as_of').maybeSingle(),
    supabase.from('earnings').select('dept, amount, source, earned_on').eq('status', 'approved'),
    // Verified donations with a live receipt; dept 'general' keeps them out of the department ranking.
    supabase.from('receipts').select('amount, payer_name, received_on, code').eq('kind', 'donation').is('voided_at', null),
    fetchRequests(supabase, { statuses: ['approved', 'paid'] }),
  ]);

  const movements: Movement[] = [];
  for (const e of earnings ?? []) {
    movements.push({ date: e.earned_on, dept: e.dept, kind: 'income', description: e.source, amount: Number(e.amount) });
  }
  for (const g of gifts ?? []) {
    movements.push({ date: g.received_on, dept: 'general', kind: 'income', description: `እርዳታ፦ ${g.payer_name} (${g.code})`, amount: Number(g.amount) });
  }
  for (const r of requests) {
    if (r.paid_at) {
      movements.push({ date: r.paid_at.slice(0, 10), dept: r.dept, kind: 'paid', description: r.reason, amount: r.amount });
    }
    if (r.spend_approved_at && r.refund > 0) {
      movements.push({ date: r.spend_approved_at.slice(0, 10), dept: r.dept, kind: 'refund', description: `ተመላሽ፦ ${r.reason}`, amount: r.refund });
    }
  }
  movements.sort((a, b) => a.date.localeCompare(b.date));

  return {
    opening: Number(w?.opening_balance ?? 0),
    asOf: (w?.as_of as string | null) ?? null,
    movements,
    requests,
  };
}

export const signed = (m: Movement) => (m.kind === 'paid' ? -m.amount : m.amount);

export type DeptContribution = {
  dept: string;
  income: number;          // approved ገቢ
  selfContributed: number; // ከራስ ወጪ (finalised spend reports)
  netOut: number;          // paid out − returned
  net: number;             // income + selfContributed − netOut
};

/** Per-department money contribution for [from, to]. */
export function contributions(
  data: Awaited<ReturnType<typeof loadWallet>>, from: string, to: string, depts: string[],
): DeptContribution[] {
  const inRange = (d: string | null | undefined) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const rows = new Map(depts.map((d) => [d, { dept: d, income: 0, selfContributed: 0, netOut: 0, net: 0 }]));
  for (const m of data.movements) {
    if (!inRange(m.date)) continue;
    const r = rows.get(m.dept);
    if (!r) continue;
    if (m.kind === 'income') r.income += m.amount;
    if (m.kind === 'paid') r.netOut += m.amount;
    if (m.kind === 'refund') r.netOut -= m.amount;
  }
  for (const q of data.requests) {
    if (q.spend_approved_at && inRange(q.spend_approved_at)) {
      const r = rows.get(q.dept);
      if (r) r.selfContributed += q.self_contributed;
    }
  }
  for (const r of rows.values()) r.net = r.income + r.selfContributed - r.netOut;
  return [...rows.values()].sort((a, b) => b.net - a.net);
}
