import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRequests } from '@/lib/money-data';
import { RequestsTable } from '@/components/requests-table';

export default async function OfficeMoneyApprovals({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const [pending, decided] = await Promise.all([
    fetchRequests(supabase, { statuses: ['pending'] }),
    fetchRequests(supabase, { statuses: ['approved', 'rejected', 'paid'] }),
  ]);
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የገንዘብ ጥያቄ ማጸደቂያ ({pending.length})</h2>
      <RequestsTable rows={pending} mode="office" />
      <h2 className="section">የተወሰነባቸው</h2>
      <RequestsTable rows={decided.slice(0, 50)} mode="office" />
    </>
  );
}
