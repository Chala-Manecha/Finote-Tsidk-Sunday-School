import { notFound, redirect } from 'next/navigation';
import { LedgerView } from './ledger-view';
import { createClient } from '@/lib/supabase/server';
import { OpeningBalance } from '@/components/opening-balance';
import { PrintButton } from '@/components/print-button';

/** ሒሳብና ንብረት and ኦዲት: ገቢ / ወጪ / ቀሪ ሂሳብ statement. (Use per department is its own tab.) */
export default async function MoneyReport({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ view?: string; p?: string; d?: string; k?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance' && dept !== 'audit') notFound();
  const sp = await searchParams;
  if (sp.view === 'usage') redirect(`/staff/${dept}/money-usage${sp.d ? `?d=${sp.d}` : ''}`);
  const supabase = await createClient();
  return (
    <>
      <div className="page-bar no-print">
        <h2 className="section" style={{ margin: 0 }}>የገንዘብ ሪፖርት</h2>
        <span className="spacer" />
        <OpeningBalance supabase={supabase} canEdit={dept === 'finance'} />
        <PrintButton />
      </div>
      <LedgerView dept={dept} sp={sp} />
    </>
  );
}
