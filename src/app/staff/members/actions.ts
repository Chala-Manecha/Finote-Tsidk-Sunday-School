'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMemberForm, DUPLICATE_NAME_MSG } from '@/lib/member-parse';

export type MemberFormState = { error?: string; ok?: string; appId?: string; regNo?: string };

/** HR registers / edits a member. With application_id, also marks that self-registration approved. */
export async function saveMember(_: MemberFormState, fd: FormData): Promise<MemberFormState> {
  const staff = await requireDept('hr', 'office');
  const id = String(fd.get('id') ?? '').trim() || null;
  const applicationId = String(fd.get('application_id') ?? '').trim() || null;
  const parsed = parseMemberForm(fd, !id);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = await createClient();
  let app: { status: string; reg_key: string | null; auth_user_id: string | null } | null = null;
  if (applicationId) {
    const { data } = await supabase.from('member_applications').select('status, reg_key, auth_user_id').eq('id', applicationId).maybeSingle();
    app = data;
    if (!app || app.status !== 'pending') return { error: 'ማመልከቻው አልተገኘም ወይም ቀደም ብሎ ተወስኗል።' };
    if (app.reg_key) parsed.member.reg_key = app.reg_key;   // keeps the number printed on their slip
  }
  const { data, error } = await supabase.rpc('save_member', { p_id: id, p_member: parsed.member, p_depts: parsed.depts });
  if (error) {
    if (error.message.includes('duplicate_name')) return { error: DUPLICATE_NAME_MSG };
    if (error.message.includes('max_two_departments')) return { error: 'ቢበዛ 2 ክፍሎች ብቻ መምረጥ ይቻላል።' };
    return { error: `ማስቀመጥ አልተቻለም፦ ${error.message}` };
  }
  if (applicationId && app) {
    // Open the login they created at registration.
    if (app.auth_user_id) await createAdminClient().from('member_accounts').insert({ member_id: data, user_id: app.auth_user_id });
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
