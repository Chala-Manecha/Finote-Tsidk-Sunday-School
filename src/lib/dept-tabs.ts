import type { DeptCode } from '@/lib/constants';

export type Tab = { slug: string; label: string; ready: boolean; group?: string };

// Shared tabs every department has (ሒሳብና ንብረት owns money/property centrally).
const shared = (dept: DeptCode): Tab[] => [
  { slug: 'members', label: 'የክፍሉ ንዑሳን', ready: true },
  { slug: 'property', label: 'የክፍሉ ንብረት', ready: true },
  ...(dept === 'finance' ? [] : [{ slug: 'money', label: 'የገንዘብ አስተዳደር', ready: true }]),
  ...(dept === 'schedule' ? [] : [{ slug: 'request-event', label: 'ቀጠሮ ላክ', ready: true }]),
  { slug: 'feedback', label: 'አስተያየቶች', ready: true },
];

// Department-specific tabs. `ready: false` = shown greyed ("በቅርቡ") until built.
const specific: Record<DeptCode, Tab[]> = {
  office: [
    { slug: 'roster', label: 'የአባላት ዝርዝር', ready: true },
    { slug: 'money-approvals', label: 'የገንዘብ ጥያቄ ማጸደቂያ', ready: true },
    { slug: 'dept-property', label: 'የክፍላት ንብረት አስተዳደር', ready: true },
    { slug: 'assignees', label: 'ክፍል ኃላፊዎች', ready: true },
    { slug: 'feedback-tracker', label: 'የአስተያየት ክትትል', ready: true },
    { slug: 'terms', label: 'የአመራር ቡድን', ready: true },
    { slug: 'departures', label: 'የመልቀቂያ ጥያቄዎች', ready: true },
  ],
  mezmur: [
    { slug: 'attendance', label: 'ክትትል መያዝ', ready: true },
    { slug: 'songs', label: 'መዝሙራት', ready: true },
    { slug: 'wereb', label: 'ወረብ', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  hr: [
    { slug: 'register', label: 'ምዝገባ (+ አባል መዝግብ)', ready: true },
    { slug: 'overview', label: 'አጠቃላይ አቴንዳንስ', ready: true },
    { slug: 'attendance', label: 'ስብሰባ ክትትል መያዝ', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
    { slug: 'all-duties', label: 'ሁሉም ምደባዎች', ready: true },
    { slug: 'departures', label: 'መልቀቂያ', ready: true },
    { slug: 'leadership', label: 'የክፍላት አመራሮች', ready: true },
    { slug: 'lost-members', label: 'የጠፉ አባላት', ready: true },
  ],
  schedule: [{ slug: 'events', label: 'ቀጠሮዎች', ready: true }],
  finance: [
    { slug: 'requests', label: 'የገንዘብ ጥያቄዎች ክትትል', ready: true },
    { slug: 'earnings', label: 'የተገኘ ገንዘብ ለማጸደቅ', ready: true },
    { slug: 'donations', label: 'እርዳታዎች', ready: true },
    { slug: 'receipts', label: 'ደረሰኞች', ready: true },
    { slug: 'tracking', label: 'የገንዘብ ክትትል', ready: true },
    { slug: 'ledger', label: 'የገንዘብ መዝገብ', ready: true },
    { slug: 'property-log', label: 'የንብረት መዝገብ', ready: true },
  ],
  development: [
    { slug: 'sale-items', label: 'የሽያጭ ዕቃዎች', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  audit: [
    { slug: 'contributions', label: 'የክፍላት ደረጃ', ready: true },
    { slug: 'ledger', label: 'የገንዘብ መዝገብ', ready: true },
    { slug: 'money-review', label: 'የገንዘብ ጥያቄዎች ክትትል', ready: true },
    { slug: 'receipts', label: 'ደረሰኞች', ready: true },
    { slug: 'donations', label: 'የእርዳታ መዝገብ', ready: true },
    { slug: 'lost-members', label: 'የጠፉ አባላት', ready: true },
    { slug: 'departures', label: 'መልቀቂያዎች', ready: true },
    { slug: 'reports', label: 'ሪፖርቶች', ready: true },
  ],
  education: [
    { slug: 'attendance', label: 'ክትትል መያዝ', ready: true },
    { slug: 'plan', label: 'ኮርስ እቅድ', ready: true },
    { slug: 'abnet', label: 'አብነት', ready: true },
    { slug: 'wereb-admin', label: 'ወረብ አስተዳደር', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  internal_comm: [
    { slug: 'home-page', label: 'የመነሻ ገጽ', ready: true },
    { slug: 'photos', label: 'ተንቀሳቃሽ ምስሎች (ዝግጅት ፎቶዎች)', ready: true },
    { slug: 'social', label: 'ማኅበራዊ ሚዲያ', ready: true },
    { slug: 'history', label: 'ታሪካችን', ready: true },
    { slug: 'mahiberat', label: 'ማኅበራት', ready: true },
    { slug: 'prayer', label: 'የጸሎት መርኀ ግብራት', ready: true },
    { slug: 'dept-docs', label: 'ክፍሎቻችን (PDF)', ready: true },
  ],
};

// ጽሕፈት ቤት has many tabs, so they are grouped (order of groups = order shown).
const OFFICE_GROUPS: [string, string[]][] = [
  ['አባላት', ['roster', 'departures', 'members']],
  ['ገንዘብና ንብረት', ['money-approvals', 'dept-property', 'money', 'property']],
  ['ክፍል ኃላፊዎች', ['assignees']],
  ['መርሐ ግብሮች', ['request-event']],
  ['አስተዳደር', ['terms', 'feedback-tracker', 'feedback']],
];

export function tabsFor(dept: DeptCode): Tab[] {
  const all = [...specific[dept], ...shared(dept)];
  if (dept !== 'office') return all;
  const bySlug = new Map(all.map((t) => [t.slug, t]));
  const grouped = OFFICE_GROUPS.flatMap(([group, slugs]) =>
    slugs.filter((s) => bySlug.has(s)).map((s) => ({ ...bySlug.get(s)!, group })));
  const seen = new Set(grouped.map((t) => t.slug));
  return [...grouped, ...all.filter((t) => !seen.has(t.slug)).map((t) => ({ ...t, group: 'ሌሎች' }))];
}
