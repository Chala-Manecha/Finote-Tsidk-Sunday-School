'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { HOME_SECTIONS, SOCIAL_PLATFORMS, type HomeSection } from '@/lib/site';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const refresh = () => revalidatePath('/', 'layout');
const denied = (m: string) => (m.includes('row-level') || m.includes('permission') ? 'ፈቃድ የለዎትም።' : m);

/** የውስጥ ግንኙነት: hero picture and texts, contacts, announcement bar, section order/visibility, photo speed. */
export async function saveHomeSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const seconds = Number(text(fd, 'marquee_seconds') || '40');
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 180) return { error: 'ፍጥነቱ ከ10 እስከ 180 ሰከንድ መሆን አለበት።' };
  const sections = (Object.keys(HOME_SECTIONS) as HomeSection[])
    .map((key) => ({ key, visible: fd.get(`visible_${key}`) === 'on', order: Number(text(fd, `order_${key}`) || '99') }))
    .sort((a, b) => a.order - b.order)
    .map(({ key, visible }) => ({ key, visible }));
  const announcement = text(fd, 'announcement');
  const coord = (k: string, max: number) => {
    const v = text(fd, k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && Math.abs(n) <= max ? n : NaN;
  };
  const lat = coord('map_lat', 90);
  const lng = coord('map_lng', 180);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { error: 'የካርታ ቁጥሮቹ ትክክል አይደሉም (ለምሳሌ 8.87890 እና 38.80538)።' };
  const email = text(fd, 'contact_email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'ትክክለኛ ኢሜይል ያስገቡ።' };
  const hero: { hero_path?: string | null } = {};
  if (text(fd, 'hero_path')) hero.hero_path = text(fd, 'hero_path');
  else if (fd.get('remove_hero') === 'on') hero.hero_path = null;
  const supabase = await createClient();
  const { error, count } = await supabase.from('site_settings').update({
    ...hero,
    hero_text: text(fd, 'hero_text') || null,
    about_title: text(fd, 'about_title') || null,
    about_text: text(fd, 'about_text') || null,
    mission: text(fd, 'mission') || null,
    vision: text(fd, 'vision') || null,
    core_values: text(fd, 'core_values') || null,
    contact_phone: text(fd, 'contact_phone') || null,
    contact_email: email || null,
    contact_address: text(fd, 'contact_address') || null,
    map_lat: lat,
    map_lng: lng,
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
