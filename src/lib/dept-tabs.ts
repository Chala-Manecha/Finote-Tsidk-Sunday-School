import type { DeptCode } from '@/lib/constants';

export type Tab = { slug: string; label: string; ready: boolean };

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
    { slug: 'photos', label: 'ዝግጅት ፎቶዎች', ready: true },
    { slug: 'history', label: 'ታሪካችን', ready: true },
    { slug: 'assignees', label: 'ክፍል ኃላፊዎች', ready: true },
    { slug: 'mahiberat', label: 'ማኀበራት አስተዳደር', ready: true },
    { slug: 'prayer', label: 'የጸሎት መርኀ ግብር አስተዳደር', ready: true },
    { slug: 'feedback-tracker', label: 'የአስተያየት ክትትል', ready: true },
  ],
  mezmur: [
    { slug: 'attendance', label: 'ክትትል መያዝ', ready: true },
    { slug: 'songs', label: 'መዝሙራት', ready: true },
    { slug: 'wereb', label: 'ወረብ', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  hr: [
    { slug: 'register', label: 'ምዝገባ (+ አባል መዝግብ)', ready: true },
    { slug: 'overview', label: 'የተዋሃደ ክትትል', ready: true },
    { slug: 'attendance', label: 'ስብሰባ ክትትል መያዝ', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
    { slug: 'all-duties', label: 'ሁሉም ምደባዎች', ready: true },
  ],
  schedule: [{ slug: 'events', label: 'ቀጠሮዎች', ready: true }],
  finance: [
    { slug: 'requests', label: 'የገንዘብ ጥያቄዎች', ready: true },
    { slug: 'earnings', label: 'የተገኘ ገንዘብ ለማጸደቅ', ready: true },
    { slug: 'tracking', label: 'የገንዘብ ክትትል', ready: true },
  ],
  development: [
    { slug: 'sale-items', label: 'የሽያጭ ዕቃዎች', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  audit: [
    { slug: 'contributions', label: 'የክፍላት አስተዋጽኦ', ready: true },
    { slug: 'money-review', label: 'የገንዘብ ጥያቄዎች ክትትል', ready: true },
    { slug: 'reports', label: 'ሪፖርቶች', ready: true },
  ],
  education: [
    { slug: 'attendance', label: 'ክትትል መያዝ', ready: true },
    { slug: 'plan', label: 'ኮርስ እቅድ', ready: true },
    { slug: 'abnet', label: 'አብነት', ready: true },
    { slug: 'wereb-admin', label: 'ወረብ አስተዳደር', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: true },
  ],
  internal_comm: [],
};

export function tabsFor(dept: DeptCode): Tab[] {
  return [...specific[dept], ...shared(dept)];
}
