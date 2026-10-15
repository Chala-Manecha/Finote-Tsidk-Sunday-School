'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseDelivery } from '@/lib/delivery';
import { SESSION_TYPES, type AttendanceStatus, type SessionType } from '@/lib/constants';

const VALID: AttendanceStatus[] = ['absent', 'present', 'half'];
const clean = (s: Record<string, string>) =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => VALID.includes(v as AttendanceStatus)));

export type SaveResult = { error?: string; redirectTo?: string };

export async function createSession(input: {
  type: SessionType;
  date: string;
  time: string | null;
  title?: string | null;
  delivery?: { mode: string; platform: string | null; link: string | null };
  statuses: Record<string, string>;
}): Promise<SaveResult> {
  const staff = await requireStaff();
  const meta = SESSION_TYPES[input.type];
  if (!meta || !canAccess(staff, meta.dept)) return { error: 'ፈቃድ የለዎትም።' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'ቀን ያስገቡ።' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_attendance_session', {
    p_type: input.type,
    p_date: input.date,
    p_time: input.time || null,
    p_statuses: clean(input.statuses),
  });
  if (error) {
    if (error.code === '23505') return { error: 'በዚህ ቀን እና ሰዓት ተመሳሳይ ክፍለ ጊዜ አስቀድሞ ተመዝግቧል።' };
    return { error: error.message };
  }
  const title = (input.title ?? '').trim().slice(0, 160);
  // was it held online or at the church?
  const fd = new FormData();
  if (input.delivery) for (const [k, v] of Object.entries(input.delivery)) if (v) fd.set(k, v);
  const dl = parseDelivery(fd);
  const extra = { ...(title ? { title } : {}), ...('error' in dl ? {} : dl) };
  if (Object.keys(extra).length) await supabase.from('attendance_sessions').update(extra).eq('id', data as string);
  revalidatePath('/staff', 'layout');
  // Client navigates + refreshes so the list and counts are fresh immediately.
  return { redirectTo: `/staff/${meta.dept}/attendance/${data}?saved=1` };
}

export async function saveSession(sessionId: string, statuses: Record<string, string>): Promise<SaveResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_attendance', {
    p_session: sessionId,
    p_statuses: clean(statuses),
  });
  if (error) return { error: error.message };
  revalidatePath('/staff', 'layout');
  return {};
}

export async function deleteSession(dept: string, sessionId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('attendance_sessions')
    .delete({ count: 'exact' })
    .eq('id', sessionId);
  if (error || !count) throw new Error(error?.message ?? 'ማጥፋት አልተቻለም።');
  revalidatePath('/staff', 'layout');
  redirect(`/staff/${dept}/attendance`);
}
