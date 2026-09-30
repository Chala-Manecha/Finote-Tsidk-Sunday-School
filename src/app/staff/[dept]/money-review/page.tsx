import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRequests } from '@/lib/money-data';
import { RequestsTable } from '@/components/requests-table';

export default async function AuditMoneyReview({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ flagged?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'audit') notFound();
  const { flagged } = await searchParams;
  const supabase = await createClient();
  let rows = await fetchRequests(supabase, { statuses: ['pending', 'approved', 'paid', 'rejected'] });
  if (flagged) rows = rows.filter((r) => r.audit_flag);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የገንዘብ ጥያቄዎች ክትትል</h2>
      <p className="muted small">ምልክት የተደረገበት ጥያቄ ለጠያቂው ክፍል እና ለሒሳብና ንብረት ይታያል።</p>
      <form className="toolbar no-print" action="/staff/audit/money-review">
        <label className="check"><input type="checkbox" name="flagged" defaultChecked={!!flagged} /> ምልክት የተደረገባቸው ብቻ</label>
        <button className="btn sm">አጣራ</button>
      </form>
      <RequestsTable rows={rows} mode="audit" />
    </>
  );
}
