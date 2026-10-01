'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { HOME_SECTIONS, SOCIAL_PLATFORMS, type HomeSection } from '@/lib/site';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const refresh = () => revalidatePath('/', 'layout');
const denied = (m: string) => (m.includes('row-level') || m.includes('permission') ? 'ፈቃድ የለዎትም።' : m);

/** የውስጥ ግንኙነት: welcome text, announcement bar, section order/visibility, photo speed. */
export async function saveHomeSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const seconds = Number(text(fd, 'marquee_seconds') || '40');
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 180) return { error: 'ፍጥነቱ ከ10 እስከ 180 ሰከንድ መሆን አለበት።' };
  const sections = (Object.keys(HOME_SECTIONS) as HomeSection[])
    .map((key) => ({ key, visible: fd.get(`visible_${key}`) === 'on', order: Number(text(fd, `order_${key}`) || '99') }))
    .sort((a, b) => a.order - b.order)
    .map(({ key, visible }) => ({ key, visible }));
  const announcement = text(fd, 'announcement');
  const supabase = await createClient();
  const { error, count } = await supabase.from('site_settings').update({
    welcome_title: text(fd, 'welcome_title') || null,
    welcome_text: text(fd, 'welcome_text') || null,
    announcement: announcement || null,
    announcement_active: fd.get('announcement_active') === 'on' && !!announcement,
    marquee_seconds: seconds,
    sections,
    updated_at: new Date().toISOString(),
  }, { count: 'exact' }).eq('id', true);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል። የመነሻ ገጹ ተዘምኗል።' };
}

export async function saveSocialLink(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const platform = text(fd, 'platform');
  let url = text(fd, 'url');
  if (!(platform in SOCIAL_PLATFORMS)) return { error: 'መድረክ ይምረጡ።' };
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/^http:\/\//i, 'https://');
  try { new URL(url); } catch { return { error: 'ትክክለኛ ሊንክ ያስገቡ (https://…)።' }; }
  const row = { platform, url, label: text(fd, 'label') || null, sort: Number(text(fd, 'sort') || '0') || 0 };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('social_links').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('social_links').insert(row, { count: 'exact' });
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}

export async function deleteSocialLink(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('social_links').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
