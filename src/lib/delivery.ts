import { PLATFORMS, type Delivery, type Platform } from './constants';

/** Read mode / platform / link from a form. Returns an error text or the three columns. */
export function parseDelivery(fd: FormData): Delivery | { error: string } {
  const mode = String(fd.get('mode') ?? 'physical') === 'online' ? 'online' : 'physical';
  if (mode === 'physical') return { mode, platform: null, link: null };
  const platform = String(fd.get('platform') ?? '');
  if (!(platform in PLATFORMS)) return { error: 'በኦንላይን ከሆነ መድረኩን (Google Meet / Telegram …) ይምረጡ።' };
  const link = String(fd.get('link') ?? '').trim();
  if (link && (!/^https?:\/\/\S+$/i.test(link) || link.length > 500)) return { error: 'ማስፈንጠሪያው (link) በ https:// መጀመር አለበት።' };
  return { mode, platform: platform as Platform, link: link || null };
}

export const deliveryLabel = (d: Partial<Delivery>) =>
  d.mode === 'online' ? `ኦንላይን · ${d.platform ? PLATFORMS[d.platform] : ''}` : 'በቤተ ክርስቲያን';
