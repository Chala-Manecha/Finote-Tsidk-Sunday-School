'use server';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/media-form';

/** HR: save the three age ranges, then re-file every member. */
export async function saveAgeGroups(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('hr');
  const codes = fd.getAll('code').map(String);
  const rows = codes.map((code) => {
    const min = Number(fd.get(`min_${code}`));
    const maxRaw = String(fd.get(`max_${code}`) ?? '').trim();
    const max = maxRaw === '' ? null : Number(maxRaw);
    return { code, name: String(fd.get(`name_${code}`) ?? '').trim(), min_age: min, max_age: max };
  });
  for (const r of rows) {
    if (!r.name) return { error: 'የክፍሉን ስም ያስገቡ።' };
    if (!Number.isInteger(r.min_age) || r.min_age < 0 || (r.max_age !== null && (!Number.isInteger(r.max_age) || r.max_age < r.min_age))) {
      return { error: `${r.name}፦ ዕድሜው ትክክል አይደለም (ከ ≤ እስከ)።` };
    }
  }
  const sorted = [...rows].sort((a, b) => a.min_age - b.min_age);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.max_age === null || prev.max_age >= sorted[i].min_age) return { error: `${prev.name} እና ${sorted[i].name} ዕድሜያቸው ይደራረባል።` };
  }
  const supabase = await createClient();
  for (const r of rows) {
    const { error } = await supabase.from('age_groups').update({ name: r.name, min_age: r.min_age, max_age: r.max_age }).eq('code', r.code);
    if (error) return { error: 'ፈቃድ የለዎትም።' };
  }
  const { data, error } = await supabase.rpc('apply_age_groups');
  if (error) return { error: error.message.includes('overlap') ? 'ዕድሜዎቹ ይደራረባሉ።' : 'መተግበር አልተቻለም።' };
  revalidatePath('/staff', 'layout');
  return { ok: `ተተግብሯል። ${data ?? 0} አባላት ክፍላቸው ተቀይሯል።` };
}
