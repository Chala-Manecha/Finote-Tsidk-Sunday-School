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

  const [{ data: profile }, { data: headDepts }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('user_id, username, full_name, sex, is_admin, is_active, staff_departments(dept)')
      .eq('user_id', userId)
      .maybeSingle(),
    // A member set as ክፍል ኃላፊ by ጽሕፈት ቤት opens that department with their own login.
    supabase.rpc('my_head_depts'),
  ]);
  const heads = ((headDepts ?? []) as DeptCode[]);
  const active = profile && profile.is_active ? profile : null;
  if (!active && heads.length === 0) return null;

  if (!active) {
    const { data: me } = await supabase.rpc('my_member_profile');
    const p = (me as { full_name: string }[] | null)?.[0];
    const { data: a } = await supabase.from('dept_assignees').select('sex').in('dept', heads).limit(1).maybeSingle();
    return { userId, username: '', fullName: p?.full_name ?? '', sex: (a?.sex as Staff['sex']) ?? null, isAdmin: false, depts: heads };
  }
  const own = (active.staff_departments ?? []).map((d: { dept: DeptCode }) => d.dept);
  return {
    userId,
    username: active.username,
    fullName: active.full_name,
    sex: active.sex,
    isAdmin: active.is_admin,
    depts: [...new Set([...own, ...heads])],
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
