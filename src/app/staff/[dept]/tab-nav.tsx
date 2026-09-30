'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Tab } from '@/lib/dept-tabs';

export function TabNav({ dept, tabs }: { dept: string; tabs: Tab[] }) {
  const path = usePathname();
  return (
    <nav className="dept-tab-nav no-print">
      {tabs.map((t, i) => {
        const header = t.group && t.group !== tabs[i - 1]?.group
          ? <div key={`g-${t.group}`} className="tab-group">{t.group}</div>
          : null;
        const href = `/staff/${dept}/${t.slug}`;
        if (!t.ready) {
          return [header,
            <span key={t.slug} title="በቅርቡ">
              {t.label} · በቅርቡ
            </span>,
          ];
        }
        return [header,
          <Link key={t.slug} href={href} className={path.startsWith(href) ? 'active' : ''}>
            {t.label}
          </Link>,
        ];
      })}
    </nav>
  );
}
