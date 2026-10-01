import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  EARNING_STATUS, MONEY_STATUS, STATUS_PILL, formatBirr, isDeptCode, type EarningStatus,
} from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { fetchRequests } from '@/lib/money-data';
import { ActionButton } from '@/components/action-button';
import { RequestMoneyForm, ExpenseForm, EarningForm } from '@/components/money-forms';
import { withdrawRequest, deleteExpense, deleteEarning } from '@/lib/actions/money';
import { ReceiveForm } from '@/components/pay-form';

const VIEWS = {
  request: 'ገንዘብ ለመጠየቅ',
  spend: 'ወጪ ሪፖርት',
  earn: 'ገቢ ሪፖርት',
} as const;
type View = keyof typeof VIEWS;

export default async function DeptMoneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ view?: string; amount?: string; source?: string }>;
}) {
  const { dept } = await params;
  if (!isDeptCode(dept) || dept === 'finance') notFound();
  const { view: v, amount, source } = await searchParams;
  const view: View = v && v in VIEWS ? (v as View) : 'request';
  const supabase = await createClient();

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የገንዘብ አስተዳደር</h2>
      <div className="subtabs no-print">
        {(Object.keys(VIEWS) as View[]).map((k) => (
          <Link scroll={false} key={k} href={`/staff/${dept}/money?view=${k}`} className={`btn sm ${k === view ? 'green' : 'secondary'}`}>
            {VIEWS[k]}
          </Link>
        ))}
      </div>
      {view === 'request' && <RequestView dept={dept} supabase={supabase} />}
      {view === 'spend' && <SpendView dept={dept} supabase={supabase} />}
      {view === 'earn' && <EarnView dept={dept} supabase={supabase} amount={amount} source={source} />}
    </>
  );
}

type Sb = Awaited<ReturnType<typeof createClient>>;

async function RequestView({ dept, supabase }: { dept: string; supabase: Sb }) {
  const rows = await fetchRequests(supabase, { dept });
  return (
    <>
      <RequestMoneyForm dept={dept} />
      <h3 className="section">የቀረቡ ጥያቄዎች</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>የጠየቀበት ቀን</th><th>መጠን</th><th>ምክንያት</th><th>የሚያስፈልግበት</th><th>ሁኔታ</th><th>የጸደቀበት ቀን</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatEc(r.requested_at)}</td>
                <td>{formatBirr(r.amount)}</td>
                <td>
                  {r.reason}
                  {r.audit_flag && (
                    <div className="small" style={{ color: 'var(--danger)' }}>
                      ⚑ ኦዲት ምልክት አድርጓል{r.audit_note ? `፦ ${r.audit_note}` : ''}
                    </div>
                  )}
                </td>
                <td>{r.needed_by ? formatEc(r.needed_by) : '—'}</td>
                <td><span className={`pill ${STATUS_PILL[r.status]}`}>{MONEY_STATUS[r.status]}</span></td>
                <td>{r.decided_at ? formatEc(r.decided_at) : '—'}</td>
                <td>
                  {r.status === 'pending' && (
                    <ActionButton action={withdrawRequest.bind(null, r.id)} label="ሰርዝ" className="btn sm danger"
                      confirmText="ጥያቄውን መሰረዝ ይፈልጋሉ?" />
                  )}
                  {r.status === 'paid' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Link className="link small" href={`/staff/vouchers/${r.id}`}>የወጪ ማዘዣ {r.voucher_no}</Link>
                      {r.received_at
                        ? <span className="small" style={{ color: 'var(--green)' }}>✓ ተረክቧል — {r.received_name}</span>
                        : <ReceiveForm id={r.id} />}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">እስካሁን ጥያቄ አልቀረበም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function SpendView({ dept, supabase }: { dept: string; supabase: Sb }) {
  const rows = await fetchRequests(supabase, { dept, statuses: ['approved', 'paid'] });
  if (rows.length === 0) {
    return <p className="muted">ወጪ ለመመዝገብ መጀመሪያ የጸደቀ የገንዘብ ጥያቄ ያስፈልጋል።</p>;
  }
  return (
    <>
      <p className="muted small">
        ተመላሽ እና ከራስ ወጪ በራሱ ይሰላል፦ ወጪው ከጸደቀው ካነሰ ልዩነቱ ተመላሽ ነው፤ ከበለጠ ትርፉ ከራስ ወጪ ነው።
        ሒሳብና ንብረት ወጪ ሪፖርቱን ካጸደቀ በኋላ መቀየር አይቻልም። ለመክፈት ርዕሱን ይጫኑ።
      </p>
      {rows.map((r) => {
        const locked = !!r.spend_approved_at;
        return (
          <details key={r.id} className="card spend-card" style={{ marginBottom: 12 }}>
            <summary>
              <b>{r.reason}</b>
              <span className="small muted">{formatBirr(r.amount)} · የወጣ {formatBirr(r.spent)}</span>
              {locked
                ? <span className="pill present">✓ ወጪ ሪፖርት ጸድቋል</span>
                : <span className={`pill ${STATUS_PILL[r.status]}`}>{MONEY_STATUS[r.status]}</span>}
            </summary>
            <div className="stat-cards">
              <div className="stat-card"><b>{formatBirr(r.amount)}</b>የጸደቀ</div>
              <div className="stat-card"><b>{formatBirr(r.spent)}</b>የወጣ</div>
              <div className="stat-card"><b>{formatBirr(r.refund)}</b>ተመላሽ</div>
              <div className="stat-card"><b>{formatBirr(r.self_contributed)}</b>ከራስ ወጪ</div>
            </div>
            {r.lines.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>ቀን</th><th>የወጣው መጠን</th><th>የወጣበት ምክንያት</th>{!locked && <th />}</tr></thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{formatEc(l.spent_on)}</td>
                        <td>{formatBirr(l.amount)}</td>
                        <td>{l.reason}</td>
                        {!locked && (
                          <td>
                            <ActionButton action={deleteExpense.bind(null, l.id)} label="አጥፋ" className="btn sm danger"
                              confirmText="ይህን የወጪ መስመር ማጥፋት ይፈልጋሉ?" />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {locked
              ? <p className="small muted" style={{ marginTop: 10 }}>ሒሳብና ንብረት ይህን ወጪ ሪፖርት አጽድቋል፤ ከዚህ በኋላ መቀየር አይቻልም።</p>
              : <div style={{ marginTop: 12 }}><ExpenseForm requestId={r.id} /></div>}
          </details>
        );
      })}
    </>
  );
}

async function EarnView({ dept, supabase, amount, source }: { dept: string; supabase: Sb; amount?: string; source?: string }) {
  const { data } = await supabase
    .from('earnings')
    .select('id, amount, source, earned_on, status, submitted_at, decided_at, receipts(id, code, voided_at)')
    .eq('dept', dept)
    .order('submitted_at', { ascending: false });
  const rows = (data ?? []) as {
    id: string; amount: number; source: string; earned_on: string; status: EarningStatus;
    submitted_at: string; decided_at: string | null;
    receipts: { id: string; code: string; voided_at: string | null }[];
  }[];
  return (
    <>
      <EarningForm dept={dept} amount={amount && Number(amount) > 0 ? amount : undefined} source={source?.slice(0, 80)} />
      <h3 className="section">የተላኩ የገቢ ሪፖርቶች</h3>
      <p className="muted small">ሒሳብና ንብረት ሲያጸድቅ ደረሰኝ ይዘጋጃል፤ አትመው ለማኅተም ወደ ሒሳብና ንብረት ይሂዱ።</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ቀን</th><th>መጠን</th><th>ምንጭ</th><th>ሁኔታ</th><th>የጸደቀበት ቀን</th><th></th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{formatEc(e.earned_on)}</td>
                <td>{formatBirr(e.amount)}</td>
                <td>{e.source}</td>
                <td><span className={`pill ${STATUS_PILL[e.status]}`}>{EARNING_STATUS[e.status]}</span></td>
                <td>{e.decided_at ? formatEc(e.decided_at) : '—'}</td>
                <td>
                  {e.receipts?.filter((x) => !x.voided_at).map((x) => (
                    <Link key={x.id} className="btn sm secondary" href={`/staff/receipts/${x.id}`}>🧾 ደረሰኝ</Link>
                  ))}
                  {e.status === 'pending' && (
                    <ActionButton action={deleteEarning.bind(null, e.id)} label="ሰርዝ" className="btn sm danger"
                      confirmText="ይህን ሪፖርት መሰረዝ ይፈልጋሉ?" />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">እስካሁን የገቢ ሪፖርት የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
