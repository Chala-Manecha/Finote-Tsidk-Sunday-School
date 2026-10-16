import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRequests, type RequestRow } from '@/lib/money-data';
import { formatBirr } from '@/lib/constants';
import { RequestsTable } from '@/components/requests-table';
import { PrintButton } from '@/components/print-button';
import { BalanceCard } from '@/components/balance-card';
import { OpeningBalance } from '@/components/opening-balance';

type Stage = { key: string; icon: string; label: string; hint: string; rows: RequestRow[] };

/** ሒሳብና ንብረት: every money request, by where it stands (one stage at a time). */
export default async function FinanceRequests({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance') notFound();
  const { s } = await searchParams;
  const supabase = await createClient();
  const all = await fetchRequests(supabase, { statuses: ['pending', 'approved', 'paid', 'rejected'] });

  const stages: Stage[] = [
    { key: 'approved', icon: '✅', label: 'በጽሕፈት ቤት የተፈቀዱ', hint: 'ለመክፈል ዝግጁ — “ክፈል” ሲጫን የወጪ ማዘዣ ይዘጋጃል።', rows: all.filter((r) => r.status === 'approved') },
    { key: 'pending', icon: '⏳', label: 'በጽሕፈት ቤት ውሳኔ እየጠበቁ ያሉ', hint: 'ጽሕፈት ቤት እስኪያጸድቅ ድረስ መክፈል አይቻልም።', rows: all.filter((r) => r.status === 'pending') },
    { key: 'unsigned', icon: '✍', label: 'ተከፍሏል — ፊርማ የሚጠብቁ', hint: 'ክፍሉ ገንዘቡን ተረክቦ እስኪፈርም።', rows: all.filter((r) => r.status === 'paid' && !r.received_at) },
    { key: 'paid', icon: '💵', label: 'የተከፈላቸው', hint: 'ክፍሉ ተረክቧል — የወጪ ሪፖርት ሲቀርብ ያጸድቁ።', rows: all.filter((r) => r.status === 'paid' && r.received_at && !r.spend_approved_at) },
    { key: 'closed', icon: '📁', label: 'ተዘግቷል / ተከልክሏል', hint: 'የወጪ ሪፖርቱ የጸደቀ ወይም የተከለከለ።', rows: all.filter((r) => r.status === 'rejected' || (r.status === 'paid' && r.spend_approved_at)) },
  ];
  const cur = stages.find((x) => x.key === s) ?? stages[0];
  const sum = (rows: RequestRow[]) => rows.reduce((t, r) => t + r.amount, 0);

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ወጪ ለማጽደቅ</h2>
        <span className="spacer" />
        <OpeningBalance supabase={supabase} canEdit />
        <PrintButton />
      </div>

      <div className="money-top no-print">
        <BalanceCard supabase={supabase} note="ሲከፈል ከዚህ ይቀነሳል። ከቀሪ ሂሳቡ በላይ መክፈል አይቻልም።" />
        <ol className="flow-steps">
          <li>ክፍሉ ይጠይቃል</li><li>ጽሕፈት ቤት ያጸድቃል</li><li>ሒሳብና ንብረት ይከፍላል</li><li>ክፍሉ ተረክቦ ይፈርማል</li><li>ወጪ ሪፖርት ይጸድቃል</li>
        </ol>
      </div>

      <div className="split">
        <aside className="rail no-print" aria-label="ደረጃዎች">
          <div className="rail-title">ደረጃ</div>
          {stages.map((x) => (
            <Link key={x.key} href={`/staff/finance/requests?s=${x.key}`} className={`${cur.key === x.key ? 'on' : ''} ${x.key === 'approved' && x.rows.length ? 'warn' : ''}`}>
              <span>{x.icon} {x.label}</span><b>{x.rows.length}</b>
            </Link>
          ))}
        </aside>
        <div className="split-main">
          <div className="split-head">
            <b>{cur.icon} {cur.label}</b><span className="count-badge">{cur.rows.length}</span>
            <span className="spacer" />
            {cur.rows.length > 0 && <span className="small">ድምር፦ <b>{formatBirr(sum(cur.rows))}</b></span>}
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>{cur.hint}</p>
          <RequestsTable rows={cur.rows} mode="finance" />
        </div>
      </div>
    </>
  );
}
