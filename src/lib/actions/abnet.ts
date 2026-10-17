'use server';
import { revalidatePath } from 'next/cache';
import { requireDept, requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FEASTS } from '@/lib/bahire-hasab';

export type FormState = { error?: string; ok?: string };
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const refresh = () => revalidatePath('/', 'layout');
const denied = (m: string) => (/row-level security|permission/i.test(m) ? 'ፈቃድ የለዎትም።' : m);

// ---------- the general feast text ----------
export async function saveHolidayText(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('abnet_settings')
    .update({ holiday_text: text(fd, 'holiday_text').slice(0, 500) || null, updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', true);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

// ---------- one greeting: a ባሕረ ሃሳብ feast's own text, a yearly day, or a monthly day ----------
export async function saveGreeting(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const kind = text(fd, 'kind');
  const name = text(fd, 'name').slice(0, 120) || null;
  const message = text(fd, 'message').slice(0, 500) || null;
  const active = fd.get('active') === 'on';
  const row: Record<string, unknown> = { kind, name, message, active, feast_key: null, ec_month: null, ec_day: null };
  if (kind === 'feast') {
    const key = text(fd, 'feast_key');
    if (!FEASTS.some((f) => f.key === key)) return { error: 'በዓሉ አልተገኘም።' };
    row.feast_key = key;
  } else if (kind === 'yearly' || kind === 'monthly') {
    const day = Number(text(fd, 'ec_day'));
    if (!(day >= 1 && day <= 30)) return { error: 'ቀኑን ይምረጡ (1–30)።' };
    row.ec_day = day;
    if (kind === 'yearly') {
      const month = Number(text(fd, 'ec_month'));
      if (!(month >= 1 && month <= 13)) return { error: 'ወሩን ይምረጡ።' };
      if (month === 13 && day > 6) return { error: 'ጳጉሜ እስከ 6 ብቻ ነው።' };
      row.ec_month = month;
      if (!name) return { error: 'የበዓሉን ስም ያስገቡ።' };
    } else if (!name && !message) return { error: 'ስም ወይም መልዕክት ያስገቡ።' };
  } else return { error: 'አይነቱን ይምረጡ።' };

  const supabase = await createClient();
  let target = id;
  if (!target && kind === 'feast') {
    const { data: old } = await supabase.from('day_greetings').select('id').eq('kind', 'feast').eq('feast_key', row.feast_key as string).maybeSingle();
    target = old?.id ?? null;
  }
  const res = target
    ? await supabase.from('day_greetings').update(row, { count: 'exact' }).eq('id', target)
    : await supabase.from('day_greetings').insert(row, { count: 'exact' });
  if (res.error) return { error: denied(res.error.message) };
  if (!res.count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

export async function deleteGreeting(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('day_greetings').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

// ---------- the coordinator (ትምህርት ክፍል chooses one member) ----------
export async function setCoordinator(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const who = text(fd, 'who');
  if (!who) return { error: 'አባሉን ይምረጡ።' };
  const supabase = await createClient();
  const reg = who.match(/[^\s()]+-[^\s()]+-[^\s()]+/)?.[0];
  const { data: found } = reg
    ? await supabase.from('members').select('id, full_name').eq('reg_no', reg).eq('is_active', true).limit(2)
    : await supabase.from('members').select('id, full_name').eq('full_name', who).eq('is_active', true).limit(2);
  if (!found?.length) return { error: 'አባሉ አልተገኘም — ከዝርዝሩ ይምረጡ።' };
  if (found.length > 1) return { error: 'በዚህ ስም ከአንድ በላይ አባል አለ — ከዝርዝሩ (በምዝገባ ቁጥሩ) ይምረጡ።' };
  const { error } = await supabase.from('abnet_coordinator').upsert({ id: true, member_id: found[0].id, set_at: new Date().toISOString() });
  if (error) return { error: denied(error.message) };
  refresh();
  return { ok: `${found[0].full_name} የአብነት አስተባባሪ ሆነዋል።` };
}

export async function removeCoordinator() {
  await requireDept('education');
  const supabase = await createClient();
  const { error } = await supabase.from('abnet_coordinator').delete().eq('id', true);
  if (error) return { error: denied(error.message) };
  refresh();
}
