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
    { slug: 'staff-access', label: 'የሲስተሙ አስተዳዳሪዎች', ready: true },
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
    { slug: 'applications', label: 'የተመዝጋቢዎች ዝርዝር', ready: true },
    { slug: 'age-groups', label: 'የዕድሜ ክፍሎች', ready: true },
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
    { slug: 'requests', label: 'ወጪ ለማጽደቅ', ready: true },
    { slug: 'earnings', label: 'ገቢ ለማጽደቅ', ready: true },
    { slug: 'donations', label: 'እርዳታዎች', ready: true },
    { slug: 'receipts', label: 'ደረሰኞች', ready: true },
    { slug: 'money-report', label: 'የገንዘብ ሪፖርት', ready: true },
    { slug: 'dept-property', label: 'የክፍላት ንብረት አስተዳደር', ready: true },
    { slug: 'property-log', label: 'የንብረት መዝገብ', ready: true },
  ],
  development: [
    { slug: 'purchases', label: 'የተገዙ ዕቃዎች መዝገብ', ready: true },
    { slug: 'sale-items', label: 'የሽያጭ ዕቃዎች', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  audit: [
    { slug: 'contributions', label: 'የክፍላት ገቢ ወጪ', ready: true },
    { slug: 'money-report', label: 'የገንዘብ ሪፖርት', ready: true },
    { slug: 'receipts', label: 'ደረሰኞች', ready: true },
    { slug: 'donations', label: 'የእርዳታ መዝገብ', ready: true },
    { slug: 'lost-members', label: 'የጠፉ አባላት', ready: true },
    { slug: 'departures', label: 'መልቀቂያዎች', ready: true },
    { slug: 'results', label: 'የትምህርት ውጤቶች እና ማጠቃለያ', ready: true },
    { slug: 'reports', label: 'ሪፖርቶች', ready: true },
  ],
  education: [
    { slug: 'academic', label: 'የትምህርት ዘመን', ready: true },
    { slug: 'classes', label: 'ክፍሎችና ተማሪዎች', ready: true },
    { slug: 'courses', label: 'ኮርሶችና መምህራን', ready: true },
    { slug: 'results', label: 'የተማሪ ውጤት', ready: true },
    { slug: 'year-end', label: 'የዓመት ማጠቃለያ', ready: true },
    { slug: 'exams', label: 'የፈተና ፈቃድና ድጋሚ ፈተና', ready: true },
    { slug: 'student-accounts', label: 'የመግቢያ ኮድ ድጋፍ', ready: true },
    { slug: 'attendance', label: 'ክትትል መያዝ (አብነት)', ready: true },
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
  ['አስተዳደር', ['terms', 'staff-access', 'feedback-tracker', 'feedback']],
];

const EDUCATION_GROUPS: [string, string[]][] = [
  ['የትምህርት ዘመን', ['academic', 'classes', 'courses']],
  ['ውጤቶች', ['results', 'exams', 'year-end', 'student-accounts']],
  ['አብነትና ወረብ', ['attendance', 'abnet', 'wereb-admin']],
  ['የክፍሉ', ['members', 'duty', 'property', 'money', 'request-event', 'feedback']],
];
const AUDIT_GROUPS: [string, string[]][] = [
  ['ገንዘብ', ['money-report', 'contributions', 'receipts', 'donations']],
  ['አባላት', ['lost-members', 'departures']],
  ['ትምህርት', ['results']],
  ['ሪፖርቶች', ['reports']],
  ['የክፍሉ', ['members', 'property', 'money', 'request-event', 'feedback']],
];
const FINANCE_GROUPS: [string, string[]][] = [
  ['ለማጽደቅ', ['requests', 'earnings', 'donations']],
  ['ሪፖርትና መዛግብት', ['money-report', 'receipts']],
  ['ንብረት', ['dept-property', 'property-log']],
  ['የክፍሉ', ['members', 'property', 'request-event', 'feedback']],
];
const HR_GROUPS: [string, string[]][] = [
  ['ምዝገባ', ['register', 'applications', 'age-groups', 'members']],
  ['ክትትል', ['overview', 'attendance', 'lost-members', 'departures']],
  ['ምደባና አመራር', ['duty', 'all-duties', 'leadership']],
  ['የክፍሉ', ['property', 'money', 'request-event', 'feedback']],
];
const GROUPS: Partial<Record<DeptCode, [string, string[]][]>> = { office: OFFICE_GROUPS, education: EDUCATION_GROUPS, hr: HR_GROUPS, audit: AUDIT_GROUPS, finance: FINANCE_GROUPS };

export function tabsFor(dept: DeptCode): Tab[] {
  const all = [...specific[dept], ...shared(dept)];
  const groups = GROUPS[dept];
  if (!groups) return all;
  const bySlug = new Map(all.map((t) => [t.slug, t]));
  const grouped = groups.flatMap(([group, slugs]) =>
    slugs.filter((s) => bySlug.has(s)).map((s) => ({ ...bySlug.get(s)!, group })));
  const seen = new Set(grouped.map((t) => t.slug));
  return [...grouped, ...all.filter((t) => !seen.has(t.slug)).map((t) => ({ ...t, group: 'ሌሎች' }))];
}
