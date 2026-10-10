import Link from 'next/link';

/** ኦዲት sees semester results and the year summary under one tab. */
export function AuditEduTabs({ current }: { current: 'results' | 'year-end' }) {
  return (
    <div className="cat-tabs no-print" style={{ marginTop: 0 }}>
      <Link href="/staff/audit/results" className={current === 'results' ? 'active' : ''}>የተማሪ ውጤት</Link>
      <Link href="/staff/audit/year-end" className={current === 'year-end' ? 'active' : ''}>የዓመት ማጠቃለያ</Link>
    </div>
  );
}
