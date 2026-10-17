import 'server-only';
import { cache } from 'react';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { DeptCode } from '@/lib/constants';

export type Staff = {
  userId: string;
  username: string;
  fullName: string;
  sex: 'male' | 'female' | null;
  isAdmin: boolean;
  depts: DeptCode[];
  /** ትምህርት ክፍል (or a system admin) — or the member chosen as the አብነት coordinator. */
  abnet: boolean;
};

/**
 * The signed-in staff member, or null. Cached per request.
 * UI-level check only — the database enforces the real rules via RLS.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: headDepts }, { data: coord }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('user_id, username, full_name, sex, is_admin, is_active, staff_departments(dept)')
      .eq('user_id', userId)
      .maybeSingle(),
    // A member set as ክፍል ኃላፊ by ጽሕፈት ቤት opens that department with their own login.
    supabase.rpc('my_head_depts'),
    // The member chosen by ትምህርት ክፍል to run አብነት.
    supabase.rpc('is_abnet_coordinator'),
  ]);
  const coordinator = coord === true;
  const heads = ((headDepts ?? []) as DeptCode[]);
  const active = profile && profile.is_active ? profile : null;
  if (!active && heads.length === 0 && !coordinator) return null;

  if (!active) {
    const { data: me } = await supabase.rpc('my_member_profile');
    const p = (me as { full_name: string; sex?: string }[] | null)?.[0];
    const { data: a } = heads.length
      ? await supabase.from('dept_assignees').select('sex').in('dept', heads).limit(1).maybeSingle()
      : { data: { sex: p?.sex } };
    return { userId, username: '', fullName: p?.full_name ?? '', sex: (a?.sex as Staff['sex']) ?? null, isAdmin: false, depts: heads, abnet: coordinator || heads.includes('education') };
  }
  const own = (active.staff_departments ?? []).map((d: { dept: DeptCode }) => d.dept);
  return {
    userId,
    username: active.username,
    fullName: active.full_name,
    sex: active.sex,
    isAdmin: active.is_admin,
    depts: [...new Set([...own, ...heads])],
    abnet: coordinator || active.is_admin || own.includes('education') || heads.includes('education'),
  };
});

export function canAccess(staff: Staff, dept: string) {
  return staff.isAdmin || staff.depts.includes(dept as DeptCode);
}

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect('/login?reason=no-staff');
  return staff;
}

export async function requireDept(...depts: DeptCode[]): Promise<Staff> {
  const staff = await requireStaff();
  if (!depts.some((d) => canAccess(staff, d))) notFound();
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (!staff.isAdmin) notFound();
  return staff;
}
