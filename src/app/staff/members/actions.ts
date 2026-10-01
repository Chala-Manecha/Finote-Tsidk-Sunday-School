'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode, MEMBER_STATUS, SEX, WORK_STATUS, TITLES, GEEZ_LEVEL } from '@/lib/constants';

export type MemberFormState = { error?: string };

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const oneOf = <T extends Record<string, string>>(v: string | null, map: T) =>
  v && v in map ? (v as keyof T & string) : null;

/** Evidence files are uploaded from the browser straight to Storage; we only get paths. */
const docPath = (v: string | null) => (v && v.startsWith('members/') ? v : null);

export async function saveMember(_: MemberFormState, fd: FormData): Promise<MemberFormState> {
  await requireDept('hr', 'office');

  const id = str(fd, 'id');
  const fullName = str(fd, 'full_name');
  const sex = oneOf(str(fd, 'sex'), SEX);
  const workStatus = oneOf(str(fd, 'work_status'), WORK_STATUS);
  const memberStatus = oneOf(str(fd, 'member_status'), MEMBER_STATUS);
  const dob = str(fd, 'dob');

  if (!fullName || fullName.length < 2) return { error: 'ሙሉ ስም ያስገቡ።' };
  if (!sex) return { error: 'ፆታ ይምረጡ።' };
  if (!workStatus) return { error: 'ሁኔታ (ተማሪ/ሠራተኛ) ይምረጡ።' };
  if (!memberStatus) return { error: 'የአባልነት ሁኔታ ይምረጡ።' };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: 'የትውልድ ቀን ትክክል አይደለም።' };

  const isEthiopian = fd.get('is_ethiopian') === 'on';
  const nationality = isEthiopian ? null : str(fd, 'nationality');
  if (!isEthiopian && !nationality) return { error: 'ዜግነት ያስገቡ።' };

  const hasPrior = fd.get('has_prior_school') === 'on';
  const hasSecular = fd.get('has_secular_school') === 'on';
  const languages = [
    ...fd.getAll('languages').map(String),
    ...(str(fd, 'language_other') ?? '').split(/[,،፣]/).map((l) => l.trim()),
  ].filter((l, i, a) => l && a.indexOf(l) === i);
  const photoPath = docPath(str(fd, 'photo_path'));
  if (!id && !photoPath) return { error: 'ፎቶ ያስገቡ።' };
  const joinedRaw = str(fd, 'joined_year');
  const joinedYear = joinedRaw ? Number(joinedRaw) : null;
  if (joinedYear !== null && (!Number.isInteger(joinedYear) || joinedYear < 1980 || joinedYear > 2100)) {
    return { error: 'የተቀላቀሉበት ዓመት ትክክል አይደለም።' };
  }

  const member = {
    full_name: fullName,
    sex,
    title: oneOf(str(fd, 'title'), TITLES),
    work_status: workStatus,
    member_status: memberStatus,
    dob,
    phone: str(fd, 'phone'),
    email: str(fd, 'email'),
    telegram_username: str(fd, 'telegram_username')?.replace(/^@/, '') ?? null,
    sub_city: str(fd, 'sub_city'),
    languages,
    photo_path: photoPath,
    joined_year: joinedYear,
    geez_level: oneOf(str(fd, 'geez_level'), GEEZ_LEVEL) ?? 'none',
    is_ethiopian: isEthiopian,
    nationality,
    prior_school: hasPrior
      ? {
          name: str(fd, 'prior_school_name'),
          years: Number(str(fd, 'prior_school_years')) || null,
          evidence_path: docPath(str(fd, 'prior_school_evidence')),
        }
      : null,
    secular_school: hasSecular
      ? {
          name: str(fd, 'secular_school_name'),
          evidence_path: docPath(str(fd, 'secular_school_evidence')),
        }
      : null,
  };
  const depts = fd.getAll('depts').map(String).filter(isDeptCode);
  if (depts.length > 2) return { error: 'ቢበዛ 2 ክፍሎች ብቻ መምረጥ ይቻላል።' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_member', {
    p_id: id,
    p_member: member,
    p_depts: depts,
  });
  if (error) {
    if (error.message.includes('duplicate_name')) return { error: 'ይህ ሙሉ ስም ቀደም ብሎ ተመዝግቧል። እባክዎ ሙሉ ስሙን (ከአያት ስም ጋር) ያረጋግጡ።' };
    if (error.message.includes('max_two_departments')) return { error: 'ቢበዛ 2 ክፍሎች ብቻ መምረጥ ይቻላል።' };
    return { error: `ማስቀመጥ አልተቻለም፦ ${error.message}` };
  }

  revalidatePath('/staff', 'layout');
  redirect(`/staff/members/${data}?saved=1`);
}

export async function deactivateMember(id: string) {
  await requireDept('hr', 'office');
  const supabase = await createClient();
  const { error } = await supabase.from('members').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/staff', 'layout');
  redirect('/staff/hr/members');
}
