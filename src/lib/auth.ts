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

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('user_id, username, full_name, sex, is_admin, is_active, staff_departments(dept)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return {
    userId,
    username: profile.username,
    fullName: profile.full_name,
    sex: profile.sex,
    isAdmin: profile.is_admin,
    depts: (profile.staff_departments ?? []).map((d: { dept: DeptCode }) => d.dept),
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
