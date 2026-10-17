import Link from 'next/link';

/** አብነት (ትምህርት ክፍል): one set of tabs across its pages. */
export function AbnetTabs({ current }: { current: 'list' | 'students' | 'att' | 'materials' | 'mahlet' | 'negs' | 'bahire' }) {
  const items: [typeof current, string, string][] = [
    ['list', '🗓 መርሐ ግብር', '/staff/education/abnet'],
    ['students', '🎓 ተማሪዎች', '/staff/education/abnet?v=students'],
    ['att', '🧾 ክትትል መያዝ', '/staff/education/attendance'],
    ['materials', '📚 መማሪያዎች', '/staff/education/abnet?v=materials'],
    ['mahlet', '🎼 ማሕሌት', '/staff/education/abnet?v=mahlet'],
    ['negs', '📜 ነግስ', '/staff/education/abnet?v=negs'],
    ['bahire', '🧮 ባሕረ ሃሳብ', '/staff/education/abnet?v=bahire'],
  ];
  return (
    <div className="seg no-print">
      {items.map(([k, l, h]) => <Link key={k} className={current === k ? 'on' : ''} href={h}>{l}</Link>)}
    </div>
  );
}
