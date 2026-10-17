// ባሕረ ሃሳብ — the Ethiopian Orthodox way of working out the year's fasts and feasts.
// Follows the classic steps: ዓመተ ዓለም → ወንጌላዊ / መባቻ → መደብ → ወንበር → አበቅቴ / መጥቅዕ → ነነዌ → the rest by their ተውሳክ.
import { EC_MONTHS, WEEKDAYS_AM, ecToIso, isoToEc, type EcDate } from './ethiopian-calendar';

export const EVANGELISTS = ['ዮሐንስ', 'ማቴዎስ', 'ማርቆስ', 'ሉቃስ'] as const;   // by ዓመተ ዓለም ÷ 4 remainder (0 → ዮሐንስ)
/** መባቻ: remainder of (ዓመተ ዓለም + መጠነ ራብዒት) ÷ 7 → 0 ሰኞ … 6 እሁድ */
const MEBACHA_DAYS = ['ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ', 'እሁድ'] as const;
/** the day's ተውሳክ for ጾመ ነነዌ, by JS weekday (0 = እሁድ) */
const DAY_TEWSAK = [7, 6, 5, 4, 3, 2, 8] as const;

/** Days after ጾመ ነነዌ (the ተውሳክ is this number less whole months of 30). */
export const FEASTS = [
  { key: 'nineveh', name: 'ጾመ ነነዌ', days: 0 },
  { key: 'abiy', name: 'ዓቢይ ጾም', days: 14 },
  { key: 'debrezeit', name: 'ደብረ ዘይት', days: 41 },
  { key: 'hosanna', name: 'ሆሣዕና', days: 62 },
  { key: 'siklet', name: 'ስቅለት', days: 67 },
  { key: 'tinsae', name: 'ትንሣኤ', days: 69 },
  { key: 'rikbe', name: 'ርክበ ካህናት', days: 93 },
  { key: 'erget', name: 'ዕርገት', days: 108 },
  { key: 'paraclete', name: 'ጰራቅሊጦስ', days: 118 },
  { key: 'hawariat', name: 'ጾመ ሐዋርያት', days: 119 },
  { key: 'dihnet', name: 'ጾመ ድኅነት', days: 121 },
] as const;
export type FeastKey = (typeof FEASTS)[number]['key'];

function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const ecLabel = (e: EcDate) => `${EC_MONTHS[e.month - 1]} ${e.day}`;

export type BahireHasab = {
  year: number;
  ameteAlem: number;          // ዓመተ ዓለም
  meteneRabiet: number;       // መጠነ ራብዒት
  evangelist: string;         // ወንጌላዊ
  evangelistRemainder: number;
  mebacha: string;            // መባቻ (the day መስከረም 1 falls on)
  mebachaRemainder: number;
  medeb: number;              // መደብ
  wenber: number;             // ወንበር
  abekte: number;             // አበቅቴ
  metqi: number;              // መጥቅዕ
  metqiDate: { ec: EcDate; iso: string; label: string; weekday: string };
  tewsak: number;             // the day's ተውሳክ (for ነነዌ)
  feasts: { key: FeastKey; name: string; tewsak: number; iso: string; ec: EcDate; label: string; weekday: string }[];
};

/** Everything for one Ethiopian year (ዓ.ም). */
export function bahireHasab(year: number): BahireHasab {
  const ameteAlem = year + 5500;
  const meteneRabiet = Math.floor(ameteAlem / 4);
  const evangelistRemainder = ameteAlem % 4;
  const mebachaRemainder = (ameteAlem + meteneRabiet) % 7;
  const medeb = ameteAlem % 19;
  const wenber = medeb === 0 ? 18 : medeb - 1;
  const abekte = (wenber * 11) % 30;
  const metqi = (wenber * 19) % 30;

  // መጥቅዕ above 14 falls in መስከረም, otherwise in ጥቅምት (0 counts as 30 መስከረም)
  const metqiEc: EcDate = metqi > 14 ? { year, month: 1, day: metqi } : metqi === 0 ? { year, month: 1, day: 30 } : { year, month: 2, day: metqi };
  const metqiIso = ecToIso(metqiEc);
  const tewsak = DAY_TEWSAK[weekday(metqiIso)];

  // ጾመ ነነዌ: (መጥቅዕ + ተውሳክ) in ጥር (መስከረም) or የካቲት (ጥቅምት); past 30 moves to the next month
  let nDay = (metqiEc.day) + tewsak;
  let nMonth = metqiEc.month === 1 ? 5 : 6;
  if (nDay > 30) { nDay -= 30; nMonth += 1; }
  const ninevehIso = ecToIso({ year, month: nMonth, day: nDay });

  const feasts = FEASTS.map((f) => {
    const iso = addDaysIso(ninevehIso, f.days);
    const ec = isoToEc(iso);
    return { key: f.key, name: f.name, tewsak: f.days % 30, iso, ec, label: ecLabel(ec), weekday: WEEKDAYS_AM[weekday(iso)] };
  });

  return {
    year, ameteAlem, meteneRabiet,
    evangelist: EVANGELISTS[evangelistRemainder], evangelistRemainder,
    mebacha: MEBACHA_DAYS[mebachaRemainder], mebachaRemainder,
    medeb, wenber, abekte, metqi,
    metqiDate: { ec: metqiEc, iso: metqiIso, label: ecLabel(metqiEc), weekday: WEEKDAYS_AM[weekday(metqiIso)] },
    tewsak, feasts,
  };
}
