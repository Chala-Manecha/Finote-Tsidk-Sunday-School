'use server';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type FormState = { error?: string; ok?: string };

/** ሰው ሃብት sets what counts as በጣም ጥሩ / ጥሩ (the rest is ደካማ). */
export async function saveBands(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('hr');
  const vg = Number(fd.get('very_good'));
  const good = Number(fd.get('good'));
  if (!Number.isInteger(vg) || !Number.isInteger(good) || vg < 1 || vg > 100 || good < 0 || good >= vg) {
    return { error: '“ጥሩ” ከ“በጣም ጥሩ” ያነሰ መሆን አለበት (0–100)።' };
  }
  const supabase = await createClient();
  const { error, count } = await supabase.from('hr_settings').update({ very_good: vg, good }, { count: 'exact' }).eq('id', true);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath('/staff', 'layout');
  revalidatePath('/student', 'layout');
  return { ok: `ተቀምጧል፦ በጣም ጥሩ ≥ ${vg}% · ጥሩ ≥ ${good}%` };
}
