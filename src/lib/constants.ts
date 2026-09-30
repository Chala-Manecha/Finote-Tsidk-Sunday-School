// DB stores English codes; these map them to the Amharic the app shows.

export const SCHOOL_NAME = 'ፍኖተ ጽድቅ ሰንበት ትምህርት ቤት';

export const DEPARTMENTS = [
  { code: 'office', name: 'ጽሕፈት ቤት' },
  { code: 'mezmur', name: 'መዝሙር ክፍል' },
  { code: 'hr', name: 'የሰው ሃብት አስተዳደር' },
  { code: 'schedule', name: 'መርሓ ግብራት' },
  { code: 'finance', name: 'ሒሳብና ንብረት አስተዳደር' },
  { code: 'development', name: 'ልማትና በጎ አድራጎት' },
  { code: 'audit', name: 'ኦዲት እና ምርመራ' },
  { code: 'education', name: 'ትምህርት ክፍል' },
  { code: 'internal_comm', name: 'የውስጥ ግንኙነት' },
] as const;

export type DeptCode = (typeof DEPARTMENTS)[number]['code'];

export const DEPT_NAME: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.code, d.name]),
);

export const isDeptCode = (v: string): v is DeptCode => v in DEPT_NAME;

export const SEX = { male: 'ወንድ', female: 'ሴት' } as const;
export const TITLES = { qesis: 'ቀሲስ', diakon: 'ዲያቆን', doctor: 'ዶክተር' } as const;
export const WORK_STATUS = { student: 'ተማሪ', worker: 'ሠራተኛ' } as const;
export const MEMBER_STATUS = { new: 'አዲስ', existing: 'ነባር', lost: 'የጠፉ' } as const;
export const GEEZ_LEVEL = { none: 'ምንም', understand: 'መረዳት ደረጃ', correct: 'ማረም ደረጃ' } as const;

export const SUB_CITIES = [
  'አቃቂ ቃሊቲ', 'አዲስ ከተማ', 'አራዳ', 'ቦሌ', 'ጉለሌ', 'ቂርቆስ',
  'ኮልፌ ቀራንዮ', 'ለሚ ኩራ', 'ልደታ', 'ንፋስ ስልክ ላፍቶ', 'የካ',
] as const;
export const LANGUAGES = ['አማርኛ', 'ኦሮምኛ', 'ትግርኛ', 'ጉራግኛ', 'ሃድይኛ', 'ሌላ'] as const;

export type SessionType = 'mezmur' | 'wereb' | 'course' | 'abnet' | 'meeting';
export const SESSION_TYPES: Record<SessionType, { label: string; dept: DeptCode }> = {
  mezmur: { label: 'መዝሙር ጥናት', dept: 'mezmur' },
  wereb: { label: 'ወረብ ጥናት', dept: 'mezmur' },
  course: { label: 'ኮርስ ተምህርት', dept: 'education' },
  abnet: { label: 'አብነት ትምህርት', dept: 'education' },
  meeting: { label: 'ስብሰባ ተሳትፎ', dept: 'hr' },
};
export const sessionTypesForDept = (dept: string) =>
  (Object.keys(SESSION_TYPES) as SessionType[]).filter((t) => SESSION_TYPES[t].dept === dept);

export type AttendanceStatus = 'absent' | 'present' | 'half';
export const ATTENDANCE_STATUS: Record<AttendanceStatus, string> = {
  absent: 'ቀሪ',
  present: 'ተገኝቷል',
  half: 'ግማሽ',
};

export const STAFF_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || 'staff.finote-tsidk.app';
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

export type EventStatus = 'pending' | 'approved' | 'rejected';
export const EVENT_STATUS: Record<EventStatus, string> = {
  pending: 'በመጠባበቅ ላይ',
  approved: 'ጸደቀ',
  rejected: 'ተከልክሏል',
};

export type MoneyStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'withdrawn';
export const MONEY_STATUS: Record<MoneyStatus, string> = {
  pending: 'በመጠባበቅ ላይ',
  approved: 'ጸደቀ',
  rejected: 'ተከልክሏል',
  paid: 'ተከፈለ',
  withdrawn: 'ተሰርዟል',
};

export type EarningStatus = 'pending' | 'approved' | 'rejected';
export const EARNING_STATUS: Record<EarningStatus, string> = {
  pending: 'በመጠባበቅ ላይ',
  approved: 'ጸደቀ',
  rejected: 'ተከልክሏል',
};

/** Status → pill colour class */
export const STATUS_PILL: Record<string, string> = {
  pending: 'half', approved: 'present', paid: 'present', rejected: 'absent', withdrawn: '',
};

export const formatBirr = (n: number | string | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ብር`;

// ---------- Duty roster (የአባላት ምደባ) ----------
export const DUTY_DEPTS = ['mezmur', 'hr', 'development', 'education'] as const;
export const DUTIES = [
  'ጸበል አስተባባሪ', 'ሰልፍ አስተባባሪ', 'መዝሙር መሪ', 'ሳር ማጨድ', 'ባንዲራ መዘርጋት', 'ልብስ ማጠብ', 'ማብሰል',
  'መሸመት/መግዛት', 'ምዕመናንን ማስተባበር', 'ዘማሪ', 'ወረብ አቅራቢ', 'ከበሮ መቺ', 'ውሃ አሳላፊ', 'ምግብ አሳላፊ',
  'ልብስ መልቀም', 'Postcard መስጠት', 'ሙዳየ ምጽዋት ማዞር', 'ጸሎት ከፋች', 'መድረክ መሪ', 'ፈታኝ',
  'Print ማድረግ', 'ደረጃ/ካርድ መስራት', 'አስተባባሪ',
] as const;
export const OCCASIONS = [
  'በዓለ አርሴማ', 'በዓለ ሩፋኤል', 'መስቀል', 'ልደት', 'ፍልሰታ', 'ነነዌ', 'ጷጉሜ ጸበል',
  'የዘወትር ስራ', 'ባዛር', 'ነዳያን ጥየቃ', 'ሱቅ', 'አመታዊ በዓል',
] as const;

// ---------- Songs (ዜማ) ----------
export const SONG_CATEGORIES = [
  { key: 'newyear', label: 'የአዲስ አመት' },
  { key: 'meskel', label: 'የመስቀል' },
  { key: 'timket', label: 'የጥምቀት' },
  { key: 'lidet', label: 'የልደት' },
  { key: 'debretabor', label: 'የደብረ ታቦር' },
  { key: 'mariam', label: 'የማርያም' },
  { key: 'melaekt', label: 'የመላእክት' },
  { key: 'semaetat', label: 'የሰማዕታት' },
  { key: 'atswamat', label: 'የአጽዋማት' },
  { key: 'tinsae', label: 'ትንሣኤ' },
  { key: 'hamsa', label: 'በዓለ ሐምሳ' },
  { key: 'zewetir', label: 'የዘወትር' },
] as const;
export const SONG_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  SONG_CATEGORIES.map((c) => [c.key, c.label]),
);

// ---------- Office-managed public schedules ----------
export const PRAYER_PROGRAMS = ['መሐረነ አብ', 'መዝሙረ ዳዊት', 'የዘወትር ጸሎት', 'ምዕራፍ'] as const;
export const MAHIBER_NAMES = ['የቅዱስ ሩፋኤል ማኅበር', 'የማርያም ማኅበር', 'የዮሐንስ ማኅበር', 'የአቡነ አረጋዊ ማኅበር'] as const;

// ---------- Education ----------
export const ABNET_SUBJECTS = ['መልእክተ ዮሐንስ', 'ውዳሴ ማርያም', 'መዝሙረ ዳዊት', 'ቅዳሴ', 'ዜማ', 'አቋቋም', 'ቅኔ'] as const;
export const ABNET_TIMES = ['ጠዋት 12:00 ጀምሮ', 'ጠዋት 3:00 ጀምሮ', 'ማታ 10:00 ጀምሮ', 'ማታ 11:00 ጀምሮ'] as const;
export const ABNET_TEACHERS = ['የኔታ አእምሮ', 'የኔታ ይባቤ'] as const;
/** Day-of-week order used in pickers (Monday first); values are JS weekday indexes (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

// ---------- Property ----------
export type ItemCondition = 'new' | 'old' | 'refurbished' | 'unusable';
export const ITEM_CONDITION: Record<ItemCondition, string> = {
  new: 'አዲስ', old: 'አሮጌ', refurbished: 'የታደሰ', unusable: 'የማያገለግል',
};

export const FEEDBACK_STATUS = { unseen: 'አልታየም', seen: 'ታይቷል' } as const;

export type PropertyLogKind = 'added' | 'maintained' | 'lost';
export const PROPERTY_LOG_KIND: Record<PropertyLogKind, string> = {
  added: 'ንብረት በመጨመር',
  maintained: 'ንብረት አያያዝ',
  lost: 'የጎደለ ንብረት',
};

// ---------- Anniversary (ምሥረታ) ----------
/**
 * Founding date in the Ethiopian calendar. Change here if it needs correcting —
 * the running anniversary year ("16ኛ ምሥረታ አመት") is computed from it.
 */
export const FOUNDED_EC = { year: 2003, month: 9, day: 13 } as const; // ግንቦት 13, 2003 ዓ.ም
