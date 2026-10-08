'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function RoleTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  // Longest matching prefix wins (/student/teach before /student).
  const active = [...tabs].sort((a, b) => b.href.length - a.href.length).find((t) => path === t.href || path.startsWith(`${t.href}/`))?.href;
  return (
    <nav className="role-switch" aria-label="ሚና">
      {tabs.map((t) => <Link key={t.href} href={t.href} className={t.href === active ? 'active' : ''}>{t.label}</Link>)}
    </nav>
  );
}
