import Link from 'next/link';
import { SONG_CATEGORIES } from '@/lib/constants';

export function CategoryTabs({ base, active }: { base: string; active?: string }) {
  const sep = base.includes('?') ? '&' : '?';
  return (
    <nav className="cat-tabs">
      <Link scroll={false} href={base} className={!active ? 'active' : ''}>ሁሉም</Link>
      {SONG_CATEGORIES.map((c) => (
        <Link scroll={false} key={c.key} href={`${base}${sep}cat=${c.key}`} className={active === c.key ? 'active' : ''}>
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
