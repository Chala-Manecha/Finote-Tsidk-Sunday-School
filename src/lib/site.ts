// Home page layout controlled by የውስጥ ግንኙነት.
export const HOME_SECTIONS = {
  welcome: 'እንኳን ደህና መጡ (የመግቢያ ጽሑፍ)',
  photos: 'ተንቀሳቃሽ ምስሎች (ዝግጅት ፎቶዎች)',
  events: 'የሳምንቱ መርሓ ግብራት',
  social: 'ማኅበራዊ ሚዲያ አዝራሮች',
} as const;
export type HomeSection = keyof typeof HOME_SECTIONS;
export type SectionSetting = { key: HomeSection; visible: boolean };

export const DEFAULT_SECTIONS: SectionSetting[] = [
  { key: 'welcome', visible: true }, { key: 'photos', visible: true },
  { key: 'events', visible: true }, { key: 'social', visible: true },
];

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
