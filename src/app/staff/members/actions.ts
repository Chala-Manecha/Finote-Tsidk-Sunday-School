'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseMemberForm, DUPLICATE_NAME_MSG } from '@/lib/member-parse';

export type MemberFormState = { error?: string; ok?: string };

/** HR registers / edits a member. With application_id, also marks that self-registration approved. */
export async function saveMember(_: MemberFormState, fd: FormData): Promise<MemberFormState> {
  const staff = await requireDept('hr', 'office');
  const id = String(fd.get('id') ?? '').trim() || null;
  const applicationId = String(fd.get('application_id') ?? '').trim() || null;
  const parsed = parseMemberForm(fd, !id);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = await createClient();
  if (applicationId) {
    const { data: app } = await supabase.from('member_applications').select('status').eq('id', applicationId).maybeSingle();
    if (!app || app.status !== 'pending') return { error: 'ማመልከቻው አልተገኘም ወይም ቀደም ብሎ ተወስኗል።' };
  }
  const { data, error } = await supabase.rpc('save_member', { p_id: id, p_member: parsed.member, p_depts: parsed.depts });
  if (error) {
    if (error.message.includes('duplicate_name')) return { error: DUPLICATE_NAME_MSG };
    if (error.message.includes('max_two_departments')) return { error: 'ቢበዛ 2 ክፍሎች ብቻ መምረጥ ይቻላል።' };
    return { error: `ማስቀመጥ አልተቻለም፦ ${error.message}` };
  }
  if (applicationId) {
    await supabase.from('member_applications').update({
      status: 'approved', member_id: data, decided_by: staff.userId, decided_at: new Date().toISOString(),
    }).eq('id', applicationId);
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
