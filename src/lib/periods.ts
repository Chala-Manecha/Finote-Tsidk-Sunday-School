import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EC_MONTHS, daysInEcMonth, ecToIso, formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';

export const PERIODS = {
  month: { label: 'ወርሃዊ', months: 1 },
  quarter: { label: 'ሩብ አመት', months: 3 },
  half: { label: 'ግማሽ አመት', months: 6 },
  year: { label: 'አመታዊ', months: 12 },
  term: { label: 'የቡድን ዘመን', months: 0 },
} as const;
export type Period = keyof typeof PERIODS;
export const isPeriod = (p?: string): p is Period => !!p && p in PERIODS;

export type Range = { from: string; to: string; label: string };

/** The last N Ethiopian months ending with the current one (ጳጉሜ folds into ነሐሴ). */
export function monthsRange(months: number): Range {
  const today = isoToEc(todayIsoAddis());
  let { year, month } = today;
  if (month === 13) month = 12;
  const to = ecToIso({ year: today.year, month: today.month, day: daysInEcMonth(today.year, today.month) });
  for (let i = 1; i < months; i++) { month--; if (month < 1) { month = 12; year--; } }
  return {
    from: ecToIso({ year, month, day: 1 }),
    to,
    label: months === 1
      ? `${EC_MONTHS[today.month - 1]} ${today.year} ዓ.ም`
      : `${EC_MONTHS[month - 1]} ${year} – ${EC_MONTHS[today.month - 1]} ${today.year} ዓ.ም`,
  };
}

export type Term = { id: string; name: string; team_no: number | null; starts_on: string | null; ends_on: string | null; is_active: boolean };

export const termLabel = (t: Pick<Term, 'name' | 'team_no'>) => (t.team_no ? `${t.name} (ቡድን-${t.team_no})` : t.name);

/** Resolve a period (or the active leadership term) to a Gregorian date range. */
export async function resolveRange(supabase: SupabaseClient, p: Period): Promise<Range & { term?: Term }> {
  if (p !== 'term') return monthsRange(PERIODS[p].months);
  const { data } = await supabase.from('leadership_terms').select('*').eq('is_active', true).maybeSingle();
  const term = data as Term | null;
  if (!term) return { ...monthsRange(12), label: 'ንቁ ቡድን አልተመዘገበም — አመታዊ ይታያል' };
  const from = term.starts_on ?? '2000-01-01';
  const to = term.ends_on && term.ends_on < todayIsoAddis() ? term.ends_on : todayIsoAddis();
  return { from, to, term, label: `${termLabel(term)} · ${formatEc(from)} – ${formatEc(to)}` };
}
