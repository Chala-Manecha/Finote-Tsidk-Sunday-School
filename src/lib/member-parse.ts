import 'server-only';
import { isDeptCode, SEX, WORK_STATUS, TITLES, GEEZ_LEVEL, MARITAL_STATUS, MEMBER_TYPE } from '@/lib/constants';
import { cleanEducation, cleanWork } from '@/lib/member-details';

export const DUPLICATE_NAME_MSG = 'በቅድሚያ ተመዝግበዋል። እባክዎ ስምዎትን በትክክል መሙላትዎን ያረጋግጡ!';

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const oneOf = <T extends Record<string, string>>(v: string | null, map: T) =>
  v && v in map ? (v as keyof T & string) : null;

/** Uploaded files arrive as storage paths; only our own folders are accepted. */
const docPath = (v: string | null) => (v && /^(members|applications)\//.test(v) ? v : null);

export type ParsedMember = { member: Record<string, unknown>; depts: string[]; fullName: string; phone: string | null };

/** Reads and checks the member form. `isNew` makes the registration-only fields required. */
export function parseMemberForm(fd: FormData, isNew: boolean): ParsedMember | { error: string } {
  const nameParts = ['first_name', 'father_name', 'grandfather_name'].map((k) => str(fd, k)?.replace(/\s+/g, ' ') ?? null);
  const [firstName, fatherName, grandfatherName] = nameParts;
  if (!firstName || !fatherName || !grandfatherName) return { error: 'ስም፣ የአባት ስም እና የአያት ስም ያስገቡ።' };
  const fullName = nameParts.join(' ');
  const maritalStatus = oneOf(str(fd, 'marital_status'), MARITAL_STATUS);
  const motherName = str(fd, 'mother_name');
  const dob = str(fd, 'dob');
  if (isNew) {
    if (!motherName) return { error: 'የእናት ስም ያስገቡ።' };
    if (!maritalStatus) return { error: 'የትዳር ሁኔታ ይምረጡ።' };
    if (!dob) return { error: 'የትውልድ ቀን ያስገቡ።' };
  }
  const sex = oneOf(str(fd, 'sex'), SEX);
  const workStatus = oneOf(str(fd, 'work_status'), WORK_STATUS);
  const memberType = oneOf(str(fd, 'member_type'), MEMBER_TYPE) ?? 'regular';
  const memberTypeOther = memberType === 'other' ? str(fd, 'member_type_other') : null;
  if (!sex) return { error: 'ፆታ ይምረጡ።' };
  if (!workStatus) return { error: 'አሁን ያሉበትን ሁኔታ (ተማሪ/ሠራተኛ) ይምረጡ።' };
  if (memberType === 'other' && !memberTypeOther) return { error: 'የአባልነት ሁኔታውን ይግለጹ።' };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: 'የትውልድ ቀን ትክክል አይደለም።' };

  const isEthiopian = fd.get('is_ethiopian') === 'on';
  const nationality = isEthiopian ? null : str(fd, 'nationality');
  if (!isEthiopian && !nationality) return { error: 'ዜግነት ያስገቡ።' };
  const languages = [
    ...fd.getAll('languages').map(String),
    ...(str(fd, 'language_other') ?? '').split(/[,،፣]/).map((l) => l.trim()),
  ].filter((l, i, a) => l && l.length <= 40 && a.indexOf(l) === i).slice(0, 20);

  const photoPath = docPath(str(fd, 'photo_path'));
  if (isNew && !photoPath) return { error: 'ፎቶ ያስገቡ።' };
  const joinedRaw = str(fd, 'joined_year');
  const joinedYear = joinedRaw ? Number(joinedRaw) : null;
  if (joinedYear !== null && (!Number.isInteger(joinedYear) || joinedYear < 1980 || joinedYear > 2100)) {
    return { error: 'የተቀላቀሉበት ዓመት ትክክል አይደለም።' };
  }
  const education = cleanEducation(str(fd, 'education_json'));
  const work = workStatus === 'worker' ? cleanWork(str(fd, 'work_json')) : [];
  const secularEvidence = docPath(str(fd, 'secular_school_evidence'));
  const depts = fd.getAll('depts').map(String).filter(isDeptCode);
  if (depts.length > 2) return { error: 'ቢበዛ 2 ክፍሎች ብቻ መምረጥ ይቻላል።' };
  const phone = str(fd, 'phone');

  const member = {
    full_name: fullName,
    sex,
    title: oneOf(str(fd, 'title'), TITLES),
    work_status: workStatus,
    dob,
    phone,
    email: str(fd, 'email'),
    telegram_username: str(fd, 'telegram_username')?.replace(/^@/, '') ?? null,
    sub_city: str(fd, 'sub_city'),
    languages,
    photo_path: photoPath,
    joined_year: joinedYear,
    geez_level: oneOf(str(fd, 'geez_level'), GEEZ_LEVEL) ?? 'none',
    is_ethiopian: isEthiopian,
    nationality,
    prior_school: fd.get('has_prior_school') === 'on'
      ? { name: str(fd, 'prior_school_name'), years: Number(str(fd, 'prior_school_years')) || null, evidence_path: docPath(str(fd, 'prior_school_evidence')) }
      : null,
    secular_school: secularEvidence || education.length
      ? { name: education[0]?.institution || education[0]?.level || null, evidence_path: secularEvidence }
      : null,
    member_type: memberType,
    member_type_other: memberTypeOther,
    first_name: firstName,
    father_name: fatherName,
    grandfather_name: grandfatherName,
    mother_name: motherName,
    christian_name: str(fd, 'christian_name'),
    baptism_church: str(fd, 'baptism_church'),
    marital_status: maritalStatus,
    region: str(fd, 'region'),
    city: str(fd, 'city'),
    woreda: str(fd, 'woreda'),
    house_no: str(fd, 'house_no'),
    phone2: str(fd, 'phone2'),
    confessor_name: str(fd, 'confessor_name'),
    confessor_phone: str(fd, 'confessor_phone'),
    emergency_name: str(fd, 'emergency_name'),
    emergency_relation: str(fd, 'emergency_relation'),
    emergency_phone: str(fd, 'emergency_phone'),
    education,
    work,
  };
  return { member, depts, fullName, phone };
}
