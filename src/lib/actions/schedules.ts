'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FIXED_KINDS } from '@/lib/schedules';
import { parseDelivery } from '@/lib/delivery';

export type FormState = { error?: string; ok?: string };

const refresh = () => {
  revalidatePath('/staff', 'layout');
  revalidatePath('/zema');
};

/** A weekly / fixed schedule (e.g. መዝሙር ጥናት every Saturday 8:00) — shown on the public page and to መርሓ ግብራት. */
export async function saveFixedSchedule(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = String(fd.get('id') ?? '') || null;
  const dept = String(fd.get('dept') ?? '');
  if (!canAccess(staff, dept)) return { error: 'ፈቃድ የለዎትም።' };
  const kind = String(fd.get('kind') ?? 'mezmur');
  const t = (k: string) => String(fd.get(k) ?? '').trim() || null;
  const row = { dept, kind, title: t('title'), day_text: t('day_text'), time_text: t('time_text'), place: t('place'), note: t('note') };
  if (!(kind in FIXED_KINDS)) return { error: 'አይነቱን ይምረጡ።' };
  const dl = parseDelivery(fd);
  if ('error' in dl) return dl;
  Object.assign(row, dl);
  if (!row.title) return { error: 'ርዕስ ያስገቡ።' };
  if (!row.day_text) return { error: 'ቀኑን ያስገቡ (ለምሳሌ፦ ዘወትር ቅዳሜ)።' };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('fixed_schedules').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('fixed_schedules').insert(row, { count: 'exact' });
  if (error) return { error: error.message };
  if (!count) return { error: 'ማስቀመጥ አልተቻለም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}

export async function deleteFixedSchedule(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('fixed_schedules').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ማጥፋት አልተቻለም።' };
  refresh();
}
