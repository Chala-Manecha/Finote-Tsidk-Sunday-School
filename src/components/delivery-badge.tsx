import { PLATFORMS, type Delivery } from '@/lib/constants';

/** 🏛 በቤተ ክርስቲያን or 💻 Google Meet (+ join link when the viewer may see it). */
export function DeliveryBadge({ d, showLink = true, compact = false }: { d: Partial<Delivery>; showLink?: boolean; compact?: boolean }) {
  if (d.mode !== 'online') return compact ? null : <span className="dlv">🏛 በቤተ ክርስቲያን</span>;
  return (
    <span className="dlv online">
      💻 {d.platform ? PLATFORMS[d.platform] : 'ኦንላይን'}
      {d.link && showLink && <> · <a href={d.link} target="_blank" rel="noopener noreferrer">ተቀላቀል ↗</a></>}
      {d.link && !showLink && <span className="small"> · 🔒 ለአባላት</span>}
    </span>
  );
}
