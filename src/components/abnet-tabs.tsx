import Link from 'next/link';

type View = 'list' | 'students' | 'att' | 'materials' | 'mahlet' | 'negs' | 'greet' | 'bahire';

/** አብነት: one set of tabs (ትምህርት ክፍል sees all; the coordinator has no students / attendance). */
export function AbnetTabs({ current, base = '/staff/education/abnet', full = true }: { current: View; base?: string; full?: boolean }) {
  const items: [View, string, string][] = [
    ['list', '🗓 መርሐ ግብር', base],
    ...(full ? [
      ['students', '🎓 ተማሪዎች', `${base}?v=students`] as [View, string, string],
      ['att', '🧾 ክትትል መያዝ', '/staff/education/attendance'] as [View, string, string],
    ] : []),
    ['materials', '📚 መማሪያዎች', `${base}?v=materials`],
    ['mahlet', '🎼 ማሕሌት', `${base}?v=mahlet`],
    ['negs', '📜 ነግስ', `${base}?v=negs`],
    ['greet', '🕊 በዓላትና መልዕክት', `${base}?v=greet`],
    ['bahire', '🧮 ባሕረ ሃሳብ', `${base}?v=bahire`],
  ];
  return (
    <div className="seg no-print">
      {items.map(([k, l, h]) => <Link key={k} className={current === k ? 'on' : ''} href={h}>{l}</Link>)}
    </div>
  );
}
