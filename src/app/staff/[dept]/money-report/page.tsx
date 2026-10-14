import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LedgerView } from './ledger-view';
import { UsageView } from './usage-view';

/** One money report for ሒሳብና ንብረት and ኦዲት: statement (ገቢ / ወጪ / ቀሪ) and use per department. */
export default async function MoneyReport({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ view?: string; p?: string; d?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const view = sp.view === 'usage' ? 'usage' : 'statement';
  const base = `/staff/${dept}/money-report`;
  return (
    <>
      <div className="head-row no-print">
        <h2 className="section">የገንዘብ ሪፖርት</h2>
        <div className="cat-tabs">
          <Link href={base} className={view === 'statement' ? 'active' : ''}>ገቢ፣ ወጪ እና ቀሪ ሂሳብ</Link>
          <Link href={`${base}?view=usage`} className={view === 'usage' ? 'active' : ''}>የክፍላት ገንዘብ አጠቃቀም</Link>
        </div>
      </div>
      {view === 'usage' ? <UsageView dept={dept} d={sp.d} /> : <LedgerView dept={dept} sp={sp} />}
    </>
  );
}
