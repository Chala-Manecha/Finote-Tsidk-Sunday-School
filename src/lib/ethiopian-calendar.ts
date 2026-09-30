// Ethiopian (Amete Mihret) ⇄ Gregorian conversion via Julian Day Numbers.
// All dates are stored in the DB as Gregorian ISO strings (YYYY-MM-DD);
// the UI enters and displays Ethiopian dates.

export const EC_MONTHS = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ',
] as const;

export const WEEKDAYS_AM = ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ'] as const;

export type EcDate = { year: number; month: number; day: number }; // month 1..13

const EC_EPOCH = 1723856; // JDN offset for Amete Mihret

const div = (a: number, b: number) => Math.floor(a / b);
const mod = (a: number, b: number) => a - b * Math.floor(a / b);

/** ጳጉሜ has 6 days in the year before a Gregorian leap year (EC year % 4 === 3). */
export function isEcLeapYear(year: number): boolean {
  return mod(year, 4) === 3;
}

export function daysInEcMonth(year: number, month: number): number {
  if (month < 13) return 30;
  return isEcLeapYear(year) ? 6 : 5;
}

function ecToJdn({ year, month, day }: EcDate): number {
  return EC_EPOCH + 365 + 365 * (year - 1) + div(year, 4) + 30 * month + day - 31;
}

function jdnToEc(jdn: number): EcDate {
  const r = mod(jdn - EC_EPOCH, 1461);
  const n = mod(r, 365) + 365 * div(r, 1460);
  const year = 4 * div(jdn - EC_EPOCH, 1461) + div(r, 365) - div(r, 1460);
  const month = div(n, 30) + 1;
  const day = mod(n, 30) + 1;
  return { year, month, day };
}

function gcToJdn(y: number, m: number, d: number): number {
  const a = div(14 - m, 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + div(153 * mm + 2, 5) + 365 * yy + div(yy, 4) - div(yy, 100) + div(yy, 400) - 32045;
}

function jdnToGc(jdn: number): { y: number; m: number; d: number } {
  const a = jdn + 32044;
  const b = div(4 * a + 3, 146097);
  const c = a - div(146097 * b, 4);
  const d = div(4 * c + 3, 1461);
  const e = c - div(1461 * d, 4);
  const m = div(5 * e + 2, 153);
  return {
    d: e - div(153 * m + 2, 5) + 1,
    m: m + 3 - 12 * div(m, 10),
    y: 100 * b + d - 4800 + div(m, 10),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** EC → Gregorian ISO date string (YYYY-MM-DD). */
export function ecToIso(ec: EcDate): string {
  const { y, m, d } = jdnToGc(ecToJdn(ec));
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Gregorian ISO (YYYY-MM-DD, or a full timestamp) → EC. */
export function isoToEc(iso: string): EcDate {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return jdnToEc(gcToJdn(y, m, d));
}

export function isValidEc({ year, month, day }: EcDate): boolean {
  return (
    Number.isInteger(year) && month >= 1 && month <= 13 &&
    day >= 1 && day <= daysInEcMonth(year, month)
  );
}

/** Weekday index 0 = Sunday for a Gregorian ISO date. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return mod(gcToJdn(y, m, d) + 1, 7);
}

/** "ሰኞ፣ መስከረም 20 2019 ዓ.ም" */
export function formatEc(iso: string | null | undefined, opts: { weekday?: boolean } = {}): string {
  if (!iso) return '—';
  const ec = isoToEc(iso);
  const base = `${EC_MONTHS[ec.month - 1]} ${ec.day} ${ec.year} ዓ.ም`;
  return opts.weekday ? `${WEEKDAYS_AM[weekdayOf(iso)]}፣ ${base}` : base;
}

/** Today's Gregorian date in Addis Ababa (UTC+3, no DST). */
export function todayIsoAddis(): string {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function todayEc(): EcDate {
  return isoToEc(todayIsoAddis());
}

/** Whole years between a Gregorian birth date and today (Addis). */
export function ageFromIso(dobIso: string | null | undefined, todayIso = todayIsoAddis()): number | null {
  if (!dobIso) return null;
  const [by, bm, bd] = dobIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

/** First/last Gregorian day of the EC month containing `iso`. */
export function ecMonthRange(iso: string): { from: string; to: string } {
  const ec = isoToEc(iso);
  return {
    from: ecToIso({ ...ec, day: 1 }),
    to: ecToIso({ ...ec, day: daysInEcMonth(ec.year, ec.month) }),
  };
}
