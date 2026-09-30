'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { USERNAME_RE, usernameToEmail } from '@/lib/constants';

export type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/staff');

  if (!USERNAME_RE.test(username) || !password) {
    return { error: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ትክክል አይደለም።' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) return { error: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ትክክል አይደለም።' };

  redirect(next.startsWith('/staff') ? next : '/staff');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
