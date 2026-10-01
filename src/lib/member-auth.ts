import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type MemberUser = { memberId: string; fullName: string; regNo: string; photoPath: string | null };

/** The member behind the current login (student / teacher), or null. */
export const getMember = cache(async (): Promise<MemberUser | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const { data: id } = await supabase.rpc('current_member_id');
  if (!id) return null;
  // Members can't read the members table directly; the definer view below returns only their own row.
  const { data } = await supabase.rpc('my_member_profile');
  const p = (data as { full_name: string; reg_no: string; photo_path: string | null }[] | null)?.[0];
  if (!p) return null;
  return { memberId: id as string, fullName: p.full_name, regNo: p.reg_no, photoPath: p.photo_path };
});

export async function requireMember(): Promise<MemberUser> {
  const m = await getMember();
  if (!m) redirect('/student/login');
  return m;
}
