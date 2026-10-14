// Shared by the member list, the export (Excel / PDF / QR) and the ID cards: filters, columns and templates.
import {
  DEPT_NAME, GEEZ_LEVEL, MARITAL_STATUS, MEMBER_STATUS, MEMBER_TYPE, SEX, TITLES, WORK_STATUS, memberTypeLabel,
} from './constants';
import { ageFromIso, formatEc } from './ethiopian-calendar';
import type { EducationEntry, WorkEntry } from './member-details';

export type MemberFilters = {
  q?: string; status?: string; work?: string; group?: string; type?: string; inactive?: string; dept?: string;
};
export const FILTER_KEYS = ['q', 'status', 'work', 'group', 'type', 'inactive'] as const;

/** All columns a member row may need (list, export, cards). */
export const MEMBER_COLS = [
  'id', 'reg_no', 'full_name', 'title', 'christian_name', 'sex', 'dob', 'phone', 'phone2', 'email', 'telegram_username',
  'work_status', 'member_status', 'member_type', 'member_type_other', 'age_group', 'joined_year', 'registered_on',
  'first_name', 'father_name', 'grandfather_name', 'mother_name', 'baptism_church', 'confessor_name', 'confessor_phone',
  'marital_status', 'region', 'city', 'sub_city', 'woreda', 'house_no', 'emergency_name', 'emergency_relation',
  'emergency_phone', 'geez_level', 'languages', 'education', 'work', 'photo_path', 'is_active',
].join(', ');

export type MemberRow = Record<string, unknown> & {
  id: string; reg_no: string; full_name: string; sex: keyof typeof SEX; dob: string | null; photo_path: string | null;
  age_group: string | null; depts: string[];
};

type Q = {
  eq: (c: string, v: unknown) => Q; is: (c: string, v: null) => Q; ilike: (c: string, v: string) => Q;
  in: (c: string, v: string[]) => Q;
};
/** Apply the list filters to a Supabase query on `members` (department filter is done by the caller's join). */
export function applyMemberFilters<T extends Q>(query: T, f: MemberFilters): T {
  let q = query.eq('is_active', f.inactive !== '1') as T;
  if (f.q) {
    // A registration code (letters+digits, e.g. 7K3M or ፍጽ-7K3M-Q9XD) → search reg_key; otherwise the name.
    const code = f.q.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    q = (/\d/.test(code) && code.length >= 3 ? q.ilike('reg_key', `%${code}%`) : q.ilike('full_name', `%${f.q}%`)) as T;
  }
  if (f.status) q = q.eq('member_status', f.status) as T;
  if (f.work) q = q.eq('work_status', f.work) as T;
  if (f.type && f.type in MEMBER_TYPE) q = q.eq('member_type', f.type) as T;
  if (f.group) q = (f.group === 'none' ? q.is('age_group', null) : q.eq('age_group', f.group)) as T;
  return q;
}

type Ctx = { groupName: Map<string, string>; verifyBase: string };
type Col = { key: string; label: string; group: string; get: (m: MemberRow, c: Ctx) => string | number };

const s = (v: unknown) => (v == null ? '' : String(v));
const label = <T extends Record<string, string>>(map: T, v: unknown) => (v ? map[v as keyof T] ?? s(v) : '');
const ec = (v: unknown) => (v ? formatEc(String(v)) : '');
const edu = (v: unknown) => ((v as EducationEntry[] | null) ?? [])
  .map((e) => [e.level, e.field, e.institution].filter(Boolean).join(' · ')).join(' | ');
const work = (v: unknown) => ((v as WorkEntry[] | null) ?? [])
  .map((e) => [e.field, e.workplace].filter(Boolean).join(' · ')).join(' | ');

export const EXPORT_COLUMNS: Col[] = [
  { key: 'reg_no', label: 'የምዝገባ ቁጥር', group: 'መሠረታዊ', get: (m) => s(m.reg_no) },
  { key: 'full_name', label: 'ሙሉ ስም', group: 'መሠረታዊ', get: (m) => s(m.full_name) },
  { key: 'title', label: 'ማዕረግ', group: 'መሠረታዊ', get: (m) => label(TITLES, m.title) },
  { key: 'sex', label: 'ፆታ', group: 'መሠረታዊ', get: (m) => label(SEX, m.sex) },
  { key: 'dob', label: 'የትውልድ ቀን (ዓ.ም)', group: 'መሠረታዊ', get: (m) => ec(m.dob) },
  { key: 'age', label: 'ዕድሜ', group: 'መሠረታዊ', get: (m) => ageFromIso(m.dob) ?? '' },
  { key: 'age_group', label: 'የዕድሜ ክፍል', group: 'መሠረታዊ', get: (m, c) => (m.age_group ? c.groupName.get(m.age_group) ?? '' : '') },
  { key: 'member_type', label: 'የአባልነት ሁኔታ', group: 'አባልነት', get: (m) => memberTypeLabel(s(m.member_type), s(m.member_type_other)) },
  { key: 'member_status', label: 'ሁኔታ', group: 'አባልነት', get: (m) => label(MEMBER_STATUS, m.member_status) },
  { key: 'joined_year', label: 'አገልግሎት የጀመሩበት (ዓ.ም)', group: 'አባልነት', get: (m) => s(m.joined_year) },
  { key: 'registered_on', label: 'የምዝገባ ቀን', group: 'አባልነት', get: (m) => ec(m.registered_on) },
  { key: 'depts', label: 'የመረጡት ክፍል', group: 'አባልነት', get: (m) => m.depts.map((d) => DEPT_NAME[d]).join('፣ ') },
  { key: 'christian_name', label: 'የክርስትና ስም', group: 'ጥምቀትና ንስሐ', get: (m) => s(m.christian_name) },
  { key: 'baptism_church', label: 'የተጠመቁበት ቤተ ክርስቲያን', group: 'ጥምቀትና ንስሐ', get: (m) => s(m.baptism_church) },
  { key: 'confessor_name', label: 'የንስሐ አባት', group: 'ጥምቀትና ንስሐ', get: (m) => s(m.confessor_name) },
  { key: 'confessor_phone', label: 'የንስሐ አባት ስልክ', group: 'ጥምቀትና ንስሐ', get: (m) => s(m.confessor_phone) },
  { key: 'father_name', label: 'የአባት ስም', group: 'ቤተሰብ', get: (m) => s(m.father_name) },
  { key: 'grandfather_name', label: 'የአያት ስም', group: 'ቤተሰብ', get: (m) => s(m.grandfather_name) },
  { key: 'mother_name', label: 'የእናት ስም', group: 'ቤተሰብ', get: (m) => s(m.mother_name) },
  { key: 'marital_status', label: 'የጋብቻ ሁኔታ', group: 'ቤተሰብ', get: (m) => label(MARITAL_STATUS, m.marital_status) },
  { key: 'phone', label: 'ስልክ', group: 'አድራሻ', get: (m) => s(m.phone) },
  { key: 'phone2', label: 'ተጨማሪ ስልክ', group: 'አድራሻ', get: (m) => s(m.phone2) },
  { key: 'email', label: 'ኢሜይል', group: 'አድራሻ', get: (m) => s(m.email) },
  { key: 'telegram', label: 'Telegram', group: 'አድራሻ', get: (m) => s(m.telegram_username) },
  { key: 'region', label: 'ክልል', group: 'አድራሻ', get: (m) => s(m.region) },
  { key: 'city', label: 'ከተማ', group: 'አድራሻ', get: (m) => s(m.city) },
  { key: 'sub_city', label: 'ክፍለ ከተማ', group: 'አድራሻ', get: (m) => s(m.sub_city) },
  { key: 'woreda', label: 'ወረዳ', group: 'አድራሻ', get: (m) => s(m.woreda) },
  { key: 'house_no', label: 'የቤት ቁጥር', group: 'አድራሻ', get: (m) => s(m.house_no) },
  { key: 'emergency_name', label: 'የአደጋ ጊዜ ተጠሪ', group: 'የአደጋ ጊዜ', get: (m) => s(m.emergency_name) },
  { key: 'emergency_relation', label: 'ዝምድና', group: 'የአደጋ ጊዜ', get: (m) => s(m.emergency_relation) },
  { key: 'emergency_phone', label: 'የተጠሪ ስልክ', group: 'የአደጋ ጊዜ', get: (m) => s(m.emergency_phone) },
  { key: 'work_status', label: 'የስራ ሁኔታ', group: 'ትምህርትና ሥራ', get: (m) => label(WORK_STATUS, m.work_status) },
  { key: 'education', label: 'ትምህርት', group: 'ትምህርትና ሥራ', get: (m) => edu(m.education) },
  { key: 'work', label: 'ሥራ', group: 'ትምህርትና ሥራ', get: (m) => work(m.work) },
  { key: 'geez_level', label: 'የግእዝ ደረጃ', group: 'ትምህርትና ሥራ', get: (m) => label(GEEZ_LEVEL, m.geez_level) },
  { key: 'languages', label: 'ቋንቋዎች', group: 'ትምህርትና ሥራ', get: (m) => ((m.languages as string[] | null) ?? []).join('፣ ') },
  { key: 'verify_url', label: 'የመታወቂያ ማረጋገጫ (QR)', group: 'መታወቂያ', get: (m, c) => `${c.verifyBase}/verify?c=${encodeURIComponent(s(m.reg_no))}` },
];
export const COLUMN_BY_KEY = new Map(EXPORT_COLUMNS.map((c) => [c.key, c]));

export const EXPORT_TEMPLATES: { key: string; label: string; cols: string[] }[] = [
  { key: 'basic', label: 'መሠረታዊ ዝርዝር', cols: ['reg_no', 'full_name', 'sex', 'age', 'age_group', 'phone', 'member_type', 'depts'] },
  { key: 'full', label: 'ሙሉ የምዝገባ መረጃ', cols: EXPORT_COLUMNS.filter((c) => c.key !== 'verify_url').map((c) => c.key) },
  { key: 'contact', label: 'የአድራሻ ዝርዝር', cols: ['reg_no', 'full_name', 'phone', 'phone2', 'email', 'telegram', 'sub_city', 'woreda'] },
  { key: 'depts', label: 'የክፍላት አባልነት', cols: ['reg_no', 'full_name', 'sex', 'member_type', 'joined_year', 'depts'] },
  { key: 'faith', label: 'ጥምቀትና ንስሐ', cols: ['reg_no', 'full_name', 'christian_name', 'baptism_church', 'confessor_name', 'confessor_phone'] },
  { key: 'emergency', label: 'የአደጋ ጊዜ ተጠሪዎች', cols: ['reg_no', 'full_name', 'phone', 'emergency_name', 'emergency_relation', 'emergency_phone'] },
  { key: 'id', label: 'መታወቂያ / QR', cols: ['reg_no', 'full_name', 'member_type', 'verify_url'] },
];

export function cellsFor(rows: MemberRow[], cols: string[], ctx: Ctx) {
  const picked = cols.map((k) => COLUMN_BY_KEY.get(k)).filter((c): c is Col => !!c);
  return { headers: picked.map((c) => c.label), body: rows.map((m) => picked.map((c) => c.get(m, ctx))) };
}
