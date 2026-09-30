import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchDeptSummaries } from '@/lib/money-data';
import { DeptMoneySummaryTable } from '@/components/dept-money-summary';
import { PrintButton } from '@/components/print-button';

export default async function AuditContributions({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'audit') notFound();
  const supabase = await createClient();
  const { rows } = await fetchDeptSummaries(supabase);
  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የክፍላት አስተዋጽኦ</h2>
        <PrintButton />
      </div>
      <p className="muted small">የጸደቀ = የጸደቁ እና የተከፈሉ ጥያቄዎች ድምር። ገቢ = በሒሳብና ንብረት የጸደቁ ገቢዎች።</p>
      <DeptMoneySummaryTable rows={rows} />
    </>
  );
}
