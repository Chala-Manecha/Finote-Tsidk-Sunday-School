import type { SupabaseClient } from '@supabase/supabase-js';
import { todayIsoAddis } from './ethiopian-calendar';
import type { Delivery } from './constants';

export const FIXED_KINDS = { mezmur: 'መዝሙር ጥናት', wereb: 'ወረብ ጥናት', other: 'ሌላ' } as const;
export type FixedKind = keyof typeof FIXED_KINDS;
export type FixedSchedule = {
  id: string; dept: string; kind: FixedKind; title: string; day_text: string; time_text: string | null; place: string | null; note: string | null;
} & Partial<Delivery>;
export const FIXED_COLS = 'id, dept, kind, title, day_text, time_text, place, note, mode, platform';

/** withLink: staff and signed-in members only (the public role cannot read the link column). */
export async function fixedSchedules(supabase: SupabaseClient, opts: { dept?: string; kinds?: FixedKind[]; withLink?: boolean } = {}) {
  let q = supabase.from('fixed_schedules').select(opts.withLink ? `${FIXED_COLS}, link` : FIXED_COLS).order('sort').order('created_at');
  if (opts.dept) q = q.eq('dept', opts.dept);
  if (opts.kinds) q = q.in('kind', opts.kinds);
  const { data } = await q;
  return (data ?? []) as unknown as FixedSchedule[];
}

export type WerebEvent = { id: string; title: string; event_date: string; event_time: string; place: string | null } & Partial<Delivery>;
/** Approved, upcoming ወረብ ጥናት sessions (requested by መዝሙር ክፍል, approved by መርሓ ግብራት). */
export async function upcomingWereb(supabase: SupabaseClient) {
  const { data } = await supabase.from('events').select('id, title, event_date, event_time, place, mode, platform')
    .eq('kind', 'wereb').eq('status', 'approved').gte('event_date', todayIsoAddis())
    .order('event_date').order('event_time').limit(20);
  return (data ?? []) as WerebEvent[];
}
