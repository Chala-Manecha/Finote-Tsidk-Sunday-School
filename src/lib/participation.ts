import type { SupabaseClient } from '@supabase/supabase-js';

/** Areas a member takes part in, in display order. */
export const PART_AREAS = {
  meeting: 'ስብሰባ ተሳትፎ',
  course: 'ኮርስ ትምህርት',
  abnet: 'አብነት ትምህርት',
  mezmur: 'መዝሙር ጥናት',
  wereb: 'ወረብ ጥናት',
  teaching: 'ማስተማር (መምህርነት)',
  duty: 'የተለያዩ አገልግሎቶች (ምደባ)',
} as const;
export type PartArea = keyof typeof PART_AREAS;
export const PART_AREA_KEYS = Object.keys(PART_AREAS) as PartArea[];
/** Areas a member chooses to join: never present at all = “not taking part”, not 0%. */
const OPT_IN: PartArea[] = ['mezmur', 'wereb', 'abnet'];

export type PartRaw = { member_id: string; area: string; total: number; attended: number | string; pending: number };
export type PartCell = { total: number; attended: number; pending: number; pct: number | null };
export type Bands = { very_good: number; good: number };
export type Band = { key: 'vg' | 'good' | 'poor'; label: string };

export const DEFAULT_BANDS: Bands = { very_good: 85, good: 65 };

export function bandOf(pct: number | null, b: Bands): Band | null {
  if (pct === null) return null;
  if (pct >= b.very_good) return { key: 'vg', label: 'በጣም ጥሩ' };
  if (pct >= b.good) return { key: 'good', label: 'ጥሩ' };
  return { key: 'poor', label: 'ደካማ' };
}

function cell(r: PartRaw | undefined, area: PartArea): PartCell | null {
  if (!r) return null;
  const attended = Number(r.attended) || 0;
  if (r.total === 0 && r.pending === 0) return null;
  if (OPT_IN.includes(area) && attended === 0) return null;
  return { total: r.total, attended, pending: r.pending, pct: r.total ? Math.round((attended / r.total) * 100) : null };
}

/** area → cell for one member (null = does not take part). */
export function summarize(rows: PartRaw[]): Partial<Record<PartArea, PartCell>> {
  const out: Partial<Record<PartArea, PartCell>> = {};
  for (const a of PART_AREA_KEYS) {
    const c = cell(rows.find((r) => r.area === a), a);
    if (c) out[a] = c;
  }
  return out;
}

/** Overall % across the areas the member takes part in (each area weighs the same). */
export function overall(s: Partial<Record<PartArea, PartCell>>): number | null {
  const pcts = Object.values(s).map((c) => c?.pct).filter((p): p is number => p !== null && p !== undefined);
  return pcts.length ? Math.round(pcts.reduce((t, p) => t + p, 0) / pcts.length) : null;
}

export async function loadBands(supabase: SupabaseClient): Promise<Bands> {
  const { data } = await supabase.from('hr_settings').select('very_good, good').maybeSingle();
  return (data as Bands | null) ?? DEFAULT_BANDS;
}

export async function memberParticipation(supabase: SupabaseClient, memberId: string, from?: string, to?: string) {
  const { data } = await supabase.rpc('participation', { p_member: memberId, p_from: from ?? null, p_to: to ?? null });
  return summarize((data ?? []) as PartRaw[]);
}

/** Every member's participation (ሰው ሃብት / ጽሕፈት ቤት / ኦዲት). */
export async function allParticipation(supabase: SupabaseClient, from?: string, to?: string) {
  const { data, error } = await supabase.rpc('participation', { p_member: null, p_from: from ?? null, p_to: to ?? null });
  if (error) throw new Error(error.message);
  const by = new Map<string, PartRaw[]>();
  for (const r of (data ?? []) as PartRaw[]) by.set(r.member_id, [...(by.get(r.member_id) ?? []), r]);
  return new Map([...by].map(([id, rows]) => [id, summarize(rows)]));
}

export const AREA_UNIT: Record<PartArea, string> = {
  meeting: 'ስብሰባ', course: 'ክፍለ ጊዜ', abnet: 'ክፍለ ጊዜ', mezmur: 'ጥናት', wereb: 'ጥናት', teaching: 'ክፍለ ጊዜ', duty: 'ምደባ',
};

/** The areas a declined program covers (መዝሙር covers both መዝሙርና ወረብ). */
export const PROGRAM_AREAS: Record<string, PartArea[]> = { course: ['course'], abnet: ['abnet'], mezmur: ['mezmur', 'wereb'], duty: ['duty'] };
export const declinedAreas = (declined: string[]) => declined.flatMap((p) => PROGRAM_AREAS[p] ?? []);
