'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FormState } from '@/components/media-form';

/**
 * የሲስተሙ አስተዳዳሪዎች: a system admin sees and manages every department.
 * Only an existing admin can add or remove one. Department heads don't need
 * this — ክፍል ኃላፊዎች gives them their department.
 */
export async function grantAdmin(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(fd.get('full_name') ?? '').trim().replace(/\s+/g, ' ');
  const admin = createAdminClient();
  const { data: found } = await admin.from('members').select('id, full_name, sex, reg_key').eq('is_active', true).ilike('full_name', name).limit(2);
  if (!found?.length) return { error: 'ይህ ስም አልተመዘገበም!' };
  if (found.length > 1) return { error: 'በዚህ ስም ከአንድ በላይ አባል አለ፤ ሙሉ ስሙን ያስገቡ።' };
  const m = found[0];
  const { data: acct } = await admin.from('member_accounts').select('user_id').eq('member_id', m.id).maybeSingle();
  if (!acct) return { error: 'ይህ አባል ገና የመግቢያ ኮድ አልፈጠረም።' };
  const { error } = await admin.from('staff_profiles').upsert({
    user_id: acct.user_id, username: `m.${m.reg_key.toLowerCase()}`, full_name: m.full_name, sex: m.sex,
    member_id: m.id, is_admin: true, is_active: true,
  }, { onConflict: 'user_id' });
  if (error) return { error: error.message };
  revalidatePath('/staff', 'layout');
  return { ok: `${m.full_name} የሲስተሙ አስተዳዳሪ ሆነዋል።` };
}

export async function revokeAdmin(userId: string) {
  const me = await requireAdmin();
  if (userId === me.userId) return { error: 'ራስዎን ማስወገድ አይችሉም።' };
  const admin = createAdminClient();
  const { count } = await admin.from('staff_profiles').select('user_id', { count: 'exact', head: true }).eq('is_admin', true).eq('is_active', true);
  if ((count ?? 0) <= 1) return { error: 'ቢያንስ አንድ አስተዳዳሪ መኖር አለበት።' };
  const { error } = await admin.from('staff_profiles').update({ is_admin: false, is_active: false }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/staff', 'layout');
}
