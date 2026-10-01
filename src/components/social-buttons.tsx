import { SOCIAL_PLATFORMS, type SocialLink } from '@/lib/site';

export function SocialButtons({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="social-buttons">
      {links.map((l) => (
        <a key={l.id} className={`social-btn s-${l.platform}`} href={l.url} target="_blank" rel="noopener noreferrer">
          {l.label || SOCIAL_PLATFORMS[l.platform]}
        </a>
      ))}
    </div>
  );
}
