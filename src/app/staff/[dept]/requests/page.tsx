import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRequests } from '@/lib/money-data';
import { RequestsTable } from '@/components/requests-table';
import { PrintButton } from '@/components/print-button';

export default async function FinanceRequests({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'finance') notFound();
  const supabase = await createClient();
  const [toPay, all] = await Promise.all([
    fetchRequests(supabase, { statuses: ['approved'] }),
    fetchRequests(supabase, { statuses: ['pending', 'paid', 'rejected'] }),
  ]);
  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የገንዘብ ጥያቄዎች</h2>
        <PrintButton />
      </div>
      <p className="muted small">በመጠባበቅ ላይ → ጸደቀ (በጽሕፈት ቤት) → ተከፈለ (እዚህ)</p>
      <h3 className="section">ለመክፈል የጸደቁ ({toPay.length})</h3>
      <RequestsTable rows={toPay} mode="finance" />
      <h3 className="section">ሌሎች</h3>
      <RequestsTable rows={all} mode="finance" />
    </>
  );
}
