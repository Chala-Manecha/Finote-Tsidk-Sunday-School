'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function readEvent(fd: FormData) {
  const title = String(fd.get('title') ?? '').trim();
  const date = String(fd.get('event_date') ?? '');
  const time = String(fd.get('event_time') ?? '');
  if (!title) return { error: 'የዝግጅቱን ስም ያስገቡ።' } as const;
  if (!DATE_RE.test(date)) return { error: 'ቀን ይምረጡ።' } as const;
  if (!TIME_RE.test(time)) return { error: 'ሰዓት ያስገቡ።' } as const;
  return { title, event_date: date, event_time: time } as const;
}

const refresh = () => {
  revalidatePath('/staff', 'layout');
  revalidatePath('/');
};

/** ቀጠሮ ላክ — any dept proposes for itself (starts pending). መርሓ ግብራት's own entries start approved. */
export async function proposeEvent(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const dept = String(fd.get('dept') ?? '');
  if (!isDeptCode(dept) || !canAccess(staff, dept)) return { error: 'ፈቃድ የለዎትም።' };
  const ev = readEvent(fd);
  if ('error' in ev) return ev;

  const supabase = await createClient();
  const { error } = await supabase.from('events').insert({
    ...ev,
    dept,
    status: dept === 'schedule' ? 'approved' : 'pending',
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: dept === 'schedule' ? 'ቀጠሮ ተጨምሯል።' : 'ቀጠሮው ለመርሓ ግብራት ተልኳል።' };
}

export async function updateEvent(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = String(fd.get('id') ?? '');
  const ev = readEvent(fd);
  if ('error' in ev) return ev;
  const supabase = await createClient();
  const { error, count } = await supabase.from('events').update(ev, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'መቀየር አልተቻለም።' };
  refresh();
  return { ok: 'ተቀይሯል።' };
}

export async function decideEvent(id: string, status: 'approved' | 'rejected') {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('events').update({ status }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** Requester withdraws a pending event, or መርሓ ግብራት removes any event. */
export async function deleteEvent(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('events').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ማጥፋት አልተቻለም።' };
  refresh();
}
