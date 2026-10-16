import Link from 'next/link';

/** አብነት (ትምህርት ክፍል): one set of tabs across its pages. */
export function AbnetTabs({ current }: { current: 'list' | 'students' | 'att' }) {
  const items: [typeof current, string, string][] = [
    ['list', '📖 ትምህርቶች', '/staff/education/abnet'],
    ['students', '🎓 ተማሪዎች', '/staff/education/abnet?v=students'],
    ['att', '🧾 ክትትል መያዝ', '/staff/education/attendance'],
  ];
  return (
    <div className="seg no-print">
      {items.map(([k, l, h]) => <Link key={k} className={current === k ? 'on' : ''} href={h}>{l}</Link>)}
    </div>
  );
}
