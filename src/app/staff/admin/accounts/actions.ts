'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { USERNAME_RE, isDeptCode, usernameToEmail } from '@/lib/constants';

export type AccountState = { error?: string; ok?: string };

const MIN_PASSWORD = 8;

export async function createStaffAccount(_: AccountState, fd: FormData): Promise<AccountState> {
  await requireAdmin();
  const username = String(fd.get('username') ?? '').trim().toLowerCase();
  const fullName = String(fd.get('full_name') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  const sex = fd.get('sex') === 'female' ? 'female' : fd.get('sex') === 'male' ? 'male' : null;
  const isAdmin = fd.get('is_admin') === 'on';
  const depts = fd.getAll('depts').map(String).filter(isDeptCode);

  if (!USERNAME_RE.test(username)) return { error: 'የተጠቃሚ ስም፦ 3–32 ፊደላት (a-z, 0-9, . _ -) ብቻ።' };
  if (fullName.length < 2) return { error: 'ሙሉ ስም ያስገቡ።' };
  if (password.length < MIN_PASSWORD) return { error: `የይለፍ ቃል ቢያንስ ${MIN_PASSWORD} ፊደል መሆን አለበት።` };
  if (!isAdmin && depts.length === 0) return { error: 'ቢያንስ አንድ ክፍል ይምረጡ።' };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (error || !data.user) {
    return { error: error?.message.includes('already') ? 'ይህ የተጠቃሚ ስም ተይዟል።' : error?.message ?? 'አልተሳካም' };
  }

  const { error: pErr } = await admin.from('staff_profiles').insert({
    user_id: data.user.id, username, full_name: fullName, sex, is_admin: isAdmin,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: pErr.message };
  }
  if (depts.length) {
    const { error: dErr } = await admin
      .from('staff_departments')
      .insert(depts.map((dept) => ({ user_id: data.user.id, dept })));
    if (dErr) return { error: dErr.message };
  }
  revalidatePath('/staff/admin/accounts');
  return { ok: `መለያ "${username}" ተፈጥሯል።` };
}

export async function updateStaffAccount(_: AccountState, fd: FormData): Promise<AccountState> {
  const me = await requireAdmin();
  const userId = String(fd.get('user_id'));
  const depts = fd.getAll('depts').map(String).filter(isDeptCode);
  const isAdmin = fd.get('is_admin') === 'on';
  const isActive = fd.get('is_active') === 'on';
  const password = String(fd.get('password') ?? '');

  if (userId === me.userId && (!isAdmin || !isActive)) {
    return { error: 'የራስዎን የአስተዳዳሪ ፈቃድ ማንሳት ወይም ማገድ አይችሉም።' };
  }
  if (password && password.length < MIN_PASSWORD) {
    return { error: `የይለፍ ቃል ቢያንስ ${MIN_PASSWORD} ፊደል መሆን አለበት።` };
  }

  const admin = createAdminClient();
  const { error: pErr } = await admin
    .from('staff_profiles')
    .update({ is_admin: isAdmin, is_active: isActive })
    .eq('user_id', userId);
  if (pErr) return { error: pErr.message };

  await admin.from('staff_departments').delete().eq('user_id', userId);
  if (depts.length) {
    const { error } = await admin
      .from('staff_departments')
      .insert(depts.map((dept) => ({ user_id: userId, dept })));
    if (error) return { error: error.message };
  }

  if (password) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return { error: error.message };
  }
  // Blocked accounts: also ban at the auth layer so existing sessions stop refreshing.
  await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? 'none' : '876000h' });

  revalidatePath('/staff/admin/accounts');
  return { ok: 'ተቀምጧል።' };
}
