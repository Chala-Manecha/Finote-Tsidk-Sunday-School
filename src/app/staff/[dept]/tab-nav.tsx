'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Tab } from '@/lib/dept-tabs';

/** Pages without their own tab light up the tab they belong to. */
const ALIAS: Record<string, string[]> = { applications: ['register'], results: ['year-end'], abnet: ['attendance'] };

const ICON: Record<string, string> = {
  abnet: '📜', academic: '🗓', 'age-groups': '👪', 'all-duties': '📋', applications: '📝', assignees: '🧑‍💼', attendance: '🧾',
  classes: '👥', contributions: '📊', 'course-attendance': '🧾', courses: '🧑‍🏫', departures: '🚪', 'dept-docs': '📄',
  'dept-property': '🏛', donations: '🎁', duty: '🧭', earnings: '💰', events: '📅', exams: '🗝', feedback: '💬',
  'feedback-tracker': '📨', 'clear-data': '🧹', 'fixed-schedule': '🔁', history: '📖', 'home-page': '🏠', leadership: '⭐', 'lost-members': '🔎',
  mahiberat: '🤝', members: '👤', money: '💵', 'money-report': '📈', 'money-usage': '📊', overview: '📊', participants: '✅',
  photos: '🖼', prayer: '🙏', property: '📦', 'property-requests': '🛒', purchases: '🧾', receipts: '🧾', reports: '📑',
  'request-event': '📮', requests: '✍', results: '🏅', roster: '📇', 'sale-items': '🏷', social: '🔗', songs: '🎵',
  'staff-access': '🔐', 'student-accounts': '🔑', terms: '🏛', wereb: '🥁', 'wereb-admin': '🥁',
};

/**
 * The department's pages listed under their group, each with its icon. On a page deeper than a tab
 * (a session, a member …) a back arrow to that tab sits at the top of the panel.
 */
export function TabNav({ dept, deptName, tabs }: { dept: string; deptName: string; tabs: Tab[] }) {
  const path = usePathname();
  // phones: the menu folds under one button (closes again when a page is chosen)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const isOn = (t: Tab) => {
    const href = `/staff/${dept}/${t.slug}`;
    return path.startsWith(href) || ((ALIAS[t.slug] ?? []).some((x) => path.startsWith(`/staff/${dept}/${x}`)) && !(dept !== 'education' && t.slug === 'abnet'));
  };
  const current = tabs.find(isOn);
  const deeper = current && path.replace(/\/$/, '') !== `/staff/${dept}/${current.slug}`;
  const groups: { name: string; tabs: Tab[] }[] = [];
  for (const t of tabs) {
    const g = t.group ?? '';
    if (groups.at(-1)?.name !== g) groups.push({ name: g, tabs: [] });
    groups.at(-1)!.tabs.push(t);
  }
  return (
    <nav className={`dept-tab-nav no-print ${open ? 'open' : ''}`} aria-label={deptName}>
      <div className="nav-head">
        {deeper
          ? <Link href={`/staff/${dept}/${current!.slug}`} className="nav-back" title="ተመለስ">← {current!.label}</Link>
          : <Link href="/staff" className="nav-back" title="ሁሉም ክፍሎች">← ሁሉም ክፍሎች</Link>}
        <b>{deptName}</b>
        <button type="button" className="nav-toggle" aria-expanded={open} onClick={() => setOpenAt(open ? null : path)}>
          <span>{current ? <><i aria-hidden>{ICON[current.slug] ?? '•'}</i> {current.label}</> : 'ገጾች'}</span>
          <b aria-hidden>{open ? '✕' : '☰'}</b>
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.name || 'all'} className="tab-sec">
          {g.name && <div className="tab-group">{g.name}</div>}
          <div className="tab-list">
            {g.tabs.map((t) => t.ready
              ? <Link key={t.slug} href={`/staff/${dept}/${t.slug}`} className={isOn(t) ? 'active' : ''}><i aria-hidden>{ICON[t.slug] ?? '•'}</i><span>{t.label}</span></Link>
              : <span key={t.slug} className="soon" title="በቅርቡ"><i aria-hidden>{ICON[t.slug] ?? '•'}</i><span>{t.label}</span></span>)}
          </div>
        </div>
      ))}
    </nav>
  );
}
