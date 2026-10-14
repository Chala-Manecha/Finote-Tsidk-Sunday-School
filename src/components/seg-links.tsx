import Link from 'next/link';

/** A row of switch buttons between related pages (one is "on"). */
export function SegLinks({ items, current }: { items: [key: string, label: string, href: string][]; current: string }) {
  return (
    <div className="seg big no-print" style={{ marginBottom: 12 }}>
      {items.map(([k, l, h]) => <Link key={k} className={current === k ? 'on' : ''} href={h}>{l}</Link>)}
    </div>
  );
}
