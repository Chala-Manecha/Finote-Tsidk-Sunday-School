import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getStaff } from '@/lib/auth';
import { getMember } from '@/lib/member-auth';

export type Role = 'student' | 'teacher' | 'leader';
export const ROLE_INFO: Record<Role, { label: string; href: string; icon: string; text: string }> = {
  student: { label: 'ተማሪ', href: '/student', icon: '📖', text: 'ውጤቶቼ፣ ክትትሌ እና የትምህርት ምዝገባ' },
  teacher: { label: 'መምህር', href: '/student/teach', icon: '🧑‍🏫', text: 'የማስተምራቸው ክፍሎች — ነጥብ እና ክትትል' },
  leader: { label: 'አመራር', href: '/staff', icon: '🗂️', text: 'የተሰጡኝ ክፍሎች ገጾች' },
};

/** The roles of whoever is signed in: ተማሪ (enrolled this year), መምህር (teaches this year), አመራር (ጽሕፈት ቤት gave access). */
export const getRoles = cache(async (): Promise<Role[]> => {
  const [staff, member] = await Promise.all([getStaff(), getMember()]);
  const roles: Role[] = [];
  if (member) {
    const supabase = await createClient();
    const { data: year } = await supabase.from('academic_years').select('id').eq('is_active', true).maybeSingle();
    const [{ count: enrolled }, { data: teach }] = await Promise.all([
      year
        ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('year_id', year.id).eq('member_id', member.memberId)
        : Promise.resolve({ count: 0 }),
      supabase.from('offering_teachers').select('course_offerings(semesters(academic_years(is_active)))').eq('member_id', member.memberId),
    ]);
    type T = { course_offerings: { semesters: { academic_years: { is_active: boolean } | null } | null } | null };
    const teachesNow = ((teach ?? []) as unknown as T[]).some((t) => t.course_offerings?.semesters?.academic_years?.is_active);
    if (enrolled) roles.push('student');
    if (teachesNow) roles.push('teacher');
  }
  if (staff) roles.push('leader');
  return roles;
});

/** Where to go after signing in: straight in with one role, the chooser with two or three. */
export async function landingPath(): Promise<string> {
  const roles = await getRoles();
  if (roles.length >= 2) return '/choose';
  if (roles.length === 1) return ROLE_INFO[roles[0]].href;
  return (await getMember()) ? '/student' : '/login';
}
