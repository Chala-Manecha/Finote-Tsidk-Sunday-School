import type { DeptCode } from '@/lib/constants';

export type Tab = { slug: string; label: string; ready: boolean };

// Shared tabs every department has (ሒሳብና ንብረት owns money/property centrally).
const shared = (dept: DeptCode): Tab[] => [
  { slug: 'members', label: 'የክፍሉ ንዑሳን', ready: true },
  { slug: 'property', label: 'የክፍሉ ንብረት', ready: false },
  ...(dept === 'finance' ? [] : [{ slug: 'money', label: 'የገንዘብ አስተዳደር', ready: false }]),
  ...(dept === 'schedule' ? [] : [{ slug: 'request-event', label: 'ቀጠሮ ላክ', ready: false }]),
  { slug: 'feedback', label: 'አስተያየቶች', ready: false },
];

// Department-specific tabs. `ready: false` = shown greyed ("በቅርቡ") until built.
const specific: Record<DeptCode, Tab[]> = {
  office: [
    { slug: 'roster', label: 'የአባላት ዝርዝር', ready: true },
    { slug: 'dept-property', label: 'የክፍላት ንብረት አስተዳደር', ready: false },
    { slug: 'photos', label: 'ዝግጅት ፎቶዎች', ready: false },
    { slug: 'history', label: 'ታሪካችን', ready: false },
    { slug: 'assignees', label: 'ክፍል ኃላፊዎች', ready: false },
    { slug: 'mahiberat', label: 'ማኀበራት አስተዳደር', ready: false },
    { slug: 'prayer', label: 'የጸሎት መርኀ ግብር አስተዳደር', ready: false },
    { slug: 'feedback-tracker', label: 'የአስተያየት ክትትል', ready: false },
  ],
  mezmur: [
    { slug: 'attendance', label: 'ክትትል መያዝ', ready: true },
    { slug: 'songs', label: 'መዝሙራት', ready: false },
    { slug: 'wereb', label: 'ወረብ', ready: false },
    { slug: 'duty', label: 'አባል መድብ', ready: false },
  ],
  hr: [
    { slug: 'register', label: 'ምዝገባ (+ አባል መዝግብ)', ready: true },
    { slug: 'overview', label: 'የተዋሃደ ክትትል', ready: true },
    { slug: 'attendance', label: 'ስብሰባ ክትትል መያዝ', ready: true },
    { slug: 'duty', label: 'አባል መድብ', ready: false },
    { slug: 'all-duties', label: 'ሁሉም ምደባዎች', ready: false },
  ],
  schedule: [{ slug: 'events', label: 'ቀጠሮዎች', ready: false }],
  finance: [
    { slug: 'earnings', label: 'የተገኘ ገንዘብ ለማጸደቅ', ready: false },
    { slug: 'requests', label: 'የገንዘብ ጥያቄዎች', ready: false },
    { slug: 'tracking', label: 'የገንዘብ ክትትል', ready: false },
  ],
  development: [
    { slug: 'sale-items', label: 'የሽያጭ ዕቃዎች', ready: false },
    { slug: 'duty', label: 'አባል መድብ', ready: false },
  ],
  audit: [
    { slug: 'reports', label: 'ሪፖርቶች', ready: false },
    { slug: 'contributions', label: 'የክፍላት አስተዋጽኦ', ready: false },
  ],
  education: [
    { slug: 'attendance', label: 'ክትትል መያዝ', ready: true },
    { slug: 'plan', label: 'ኮርስ እቅድ', ready: false },
    { slug: 'abnet', label: 'አብነት', ready: false },
    { slug: 'wereb-admin', label: 'ወረብ አስተዳደር', ready: false },
    { slug: 'duty', label: 'አባል መድብ', ready: false },
  ],
  internal_comm: [],
};

export function tabsFor(dept: DeptCode): Tab[] {
  return [...specific[dept], ...shared(dept)];
}
