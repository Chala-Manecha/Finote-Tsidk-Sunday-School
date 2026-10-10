import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRequests, type RequestRow } from '@/lib/money-data';
import { RequestsTable } from '@/components/requests-table';
import { PrintButton } from '@/components/print-button';
import { BalanceCard } from '@/components/balance-card';

/** ሒሳብና ንብረት's tracker: every request grouped by where it stands. */
export default async function FinanceRequests({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'finance') notFound();
  const supabase = await createClient();
  const all = await fetchRequests(supabase, { statuses: ['pending', 'approved', 'paid', 'rejected'] });

  const groups: [string, RequestRow[]][] = [
    ['ለመክፈል የጸደቁ', all.filter((r) => r.status === 'approved')],
    ['ተከፍሏል — የክፍሉ ፊርማ በመጠባበቅ ላይ', all.filter((r) => r.status === 'paid' && !r.received_at)],
    ['ተረክቧል — ወጪ ሪፖርት በመጠባበቅ ላይ', all.filter((r) => r.status === 'paid' && r.received_at && !r.spend_approved_at)],
    ['ጽሕፈት ቤት በመጠባበቅ ላይ', all.filter((r) => r.status === 'pending')],
    ['ተዘግቷል / ተከልክሏል', all.filter((r) => r.status === 'rejected' || (r.status === 'paid' && r.spend_approved_at))],
  ];

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>ወጪ ለማጽደቅ</h2>
        <PrintButton />
      </div>
      <BalanceCard supabase={supabase} note="ሲከፈል ከዚህ ይቀነሳል። ከቀሪ ሂሳቡ በላይ መክፈል አይቻልም።" />
      <p className="muted small">
        ጥያቄ → ጽሕፈት ቤት ያጸድቃል → ሒሳብና ንብረት ይከፍላል (የወጪ ማዘዣ ይዘጋጃል) → ክፍሉ ተረክቦ ይፈርማል (ወደ ኦዲት ይሄዳል) → ወጪ ሪፖርት → ሒሳብና ንብረት ያጸድቃል (ይዘጋል)
      </p>
      <div className="stat-cards">
        {groups.slice(0, 4).map(([label, rows]) => (
          <div key={label} className="stat-card"><b>{rows.length}</b>{label}</div>
        ))}
      </div>
      {groups.map(([label, rows]) => rows.length > 0 && (
        <section key={label}>
          <h3 className="section">{label} ({rows.length})</h3>
          <RequestsTable rows={rows} mode="finance" />
        </section>
      ))}
    </>
  );
}
