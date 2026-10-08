// Home page layout controlled by የውስጥ ግንኙነት.
// The hero (big picture at the top) is always first; these follow it in the saved order.
export const HOME_SECTIONS = {
  events: 'የሳምንቱ መርሓ ግብራት',
  photos: 'ተንቀሳቃሽ ምስሎች (ዝግጅት ፎቶዎች)',
  mission: 'ተልዕኮ፣ ራዕይ እና እሴቶች',
  about: 'ስለ እኛ (የምሥረታ ታሪክ)',
  departments: 'ክፍሎቻችን',
  welcome: 'እንኳን ደህና መጡ (የምዝገባ መረጃ)',
  donate: 'ለመርዳት ጥሪ',
  contact: 'ያግኙን (አድራሻ እና ካርታ)',
  social: 'ማኅበራዊ ሚዲያ አዝራሮች',
} as const;
export type HomeSection = keyof typeof HOME_SECTIONS;
export type SectionSetting = { key: HomeSection; visible: boolean };

export const DEFAULT_SECTIONS: SectionSetting[] = (Object.keys(HOME_SECTIONS) as HomeSection[])
  .map((key) => ({ key, visible: true }));

/** Editable texts and contacts of the public home page (site_settings columns). */
export const SITE_TEXT_COLUMNS =
  'welcome_title, welcome_text, announcement, announcement_active, marquee_seconds, sections, hero_path, hero_text, about_title, about_text, mission, vision, core_values, contact_phone, contact_email, contact_address, map_lat, map_lng';
export type SiteSettings = {
  welcome_title: string | null; welcome_text: string | null; announcement: string | null; announcement_active: boolean;
  marquee_seconds: number; sections: unknown; hero_path: string | null; hero_text: string | null;
  about_title: string | null; about_text: string | null; mission: string | null; vision: string | null;
  core_values: string | null; contact_phone: string | null; contact_email: string | null; contact_address: string | null;
  map_lat: number | string | null; map_lng: number | string | null;
};

/** Fallbacks if the row is empty (same as the migration defaults). */
export const SITE_DEFAULTS = {
  contact_phone: '+251981954946',
  contact_email: 'finotetsidiki13@gmail.com',
  contact_address: '1 • አቃቂ ቃሊቲ • አዲስ አበባ',
  map_lat: 8.8789,
  map_lng: 38.80538,
} as const;

/** Every known section exactly once, in the saved order (new sections appended). */
export function normaliseSections(raw: unknown): SectionSetting[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: SectionSetting[] = [];
  for (const s of list) {
    const key = (s as { key?: string })?.key;
    if (key && key in HOME_SECTIONS && !seen.has(key)) {
      seen.add(key);
      out.push({ key: key as HomeSection, visible: (s as { visible?: boolean }).visible !== false });
    }
  }
  for (const d of DEFAULT_SECTIONS) if (!seen.has(d.key)) out.push(d);
  return out;
}

export const SOCIAL_PLATFORMS = {
  telegram: 'Telegram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok',
  instagram: 'Instagram', x: 'X (Twitter)', website: 'ድረ-ገጽ',
} as const;
export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;
export type SocialLink = { id: string; platform: SocialPlatform; url: string; label: string | null; sort: number };
