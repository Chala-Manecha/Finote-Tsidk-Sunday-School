import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bahireHasab, FEASTS } from './bahire-hasab';
import { isoToEc, todayIsoAddis } from './ethiopian-calendar';
import { BDAY_DEFAULTS } from './site';

export const HOLIDAY_DEFAULT = 'እንኳን ለ{name} በሰላም አደረሳችሁ።\nመልካም በዓል!';

export type DayGreeting = {
  id: string; kind: 'feast' | 'yearly' | 'monthly'; feast_key: string | null; ec_month: number | null; ec_day: number | null;
  name: string | null; message: string | null; active: boolean;
};
export const GREETING_COLS = 'id, kind, feast_key, ec_month, ec_day, name, message, active';

export type Greeting = { kind: 'birthday' | 'holiday'; text: string };

const fill = (tpl: string, name: string) => (tpl.includes('{name}') ? tpl.replaceAll('{name}', name) : tpl).trim();

/** The ባሕረ ሃሳብ feasts that fall on an ISO date, by key. */
export function feastsOn(iso: string) {
  return bahireHasab(isoToEc(iso).year).feasts.filter((f) => f.iso === iso);
}

/** Today's greetings for the home page: birthdays (የውስጥ ግንኙነት text) and feasts / commemorations (አብነት text). */
export async function todaysGreetings(supabase: SupabaseClient, iso = todayIsoAddis()): Promise<Greeting[]> {
  const ec = isoToEc(iso);
  const [{ data: bdays }, { data: site }, { data: rows }, { data: ab }] = await Promise.all([
    supabase.rpc('todays_birthdays'),
    supabase.from('site_settings').select('bday_active, bday_male_text, bday_female_text').maybeSingle(),
    supabase.from('day_greetings').select(GREETING_COLS),
    supabase.from('abnet_settings').select('holiday_text').maybeSingle(),
  ]);
  const out: Greeting[] = [];
  const all = (rows ?? []) as DayGreeting[];
  const list = all.filter((r) => r.active);
  const offKeys = new Set(all.filter((r) => r.kind === 'feast' && !r.active).map((r) => r.feast_key));
  const tpl = ab?.holiday_text?.trim() || HOLIDAY_DEFAULT;

  // 1. feasts worked out by ባሕረ ሃሳብ (a 'feast' row can give one its own text, or switch it off)
  for (const f of feastsOn(iso)) {
    if (offKeys.has(f.key)) continue;
    const own = list.find((r) => r.kind === 'feast' && r.feast_key === f.key);
    const name = own?.name?.trim() || f.name;
    out.push({ kind: 'holiday', text: own?.message?.trim() ? fill(own.message, name) : fill(tpl, name) });
  }
  // 2. yearly days and 3. monthly commemorations added by አብነት
  for (const r of list) {
    const hit = (r.kind === 'yearly' && r.ec_month === ec.month && r.ec_day === ec.day) || (r.kind === 'monthly' && r.ec_day === ec.day);
    if (!hit) continue;
    const name = r.name?.trim() ?? '';
    out.push({ kind: 'holiday', text: r.message?.trim() ? fill(r.message, name) : fill(tpl, name) });
  }
  // birthdays
  if (site?.bday_active !== false) {
    for (const b of (bdays ?? []) as { name: string; sex: 'male' | 'female' }[]) {
      const t = b.sex === 'female' ? site?.bday_female_text || BDAY_DEFAULTS.female : site?.bday_male_text || BDAY_DEFAULTS.male;
      out.push({ kind: 'birthday', text: fill(t, b.name) });
    }
  }
  return out;
}

export const FEAST_NAMES = Object.fromEntries(FEASTS.map((f) => [f.key, f.name])) as Record<string, string>;
