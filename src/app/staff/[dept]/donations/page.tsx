import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DONATION_METHOD, DONATION_STATUS, formatBirr, type DonationMethod, type DonationStatus } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { isPeriod, resolveRange } from '@/lib/periods';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { ReasonForm } from '@/components/reason-form';
import { StatementHeader, StatementSignatures, PeriodTabs } from '@/components/statement';
import { saveDonationAccounts, verifyDonation, rejectDonation } from '@/lib/actions/receipts';

type D = {
  id: string; donor_name: string | null; donor_phone: string | null; amount: number; method: DonationMethod;
  txn_ref: string; purpose: string | null; status: DonationStatus; reject_reason: string | null;
  created_at: string; decided_at: string | null; receipts: { id: string; code: string; voided_at: string | null }[];
};
const COLS = 'id, donor_name, donor_phone, amount, method, txn_ref, purpose, status, reject_reason, created_at, decided_at, receipts(id, code, voided_at)';

/** ሒሳብና ንብረት verifies claims; ኦዲት sees the register with totals. */
export default async function Donations({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ p?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance' && dept !== 'audit') notFound();
  return dept === 'finance' ? <FinanceView /> : <AuditView p={(await searchParams).p} />;
}

async function FinanceView() {
  const supabase = await createClient();
  const [{ data: a }, { data }] = await Promise.all([
    supabase.from('donation_accounts').select('account_name, telebirr_number, cbe_account').maybeSingle(),
    supabase.from('donations').select(COLS).order('created_at', { ascending: false }).limit(200),
  ]);
  const rows = (data ?? []) as unknown as D[];
  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');
  const live = (r: D) => r.receipts.find((x) => !x.voided_at);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>እርዳታዎች</h2>
      <details className="card" style={{ marginBottom: 12 }}>
        <summary><b>የሰንበት ትምህርት ቤቱ ሂሳቦች</b> <span className="small muted">— በ“ለመርዳት” ገጽ ላይ የሚታዩ</span></summary>
        <MediaForm action={saveDonationAccounts} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
          <div className="form-grid">
            <div className="field"><label>የሂሳቡ ስም</label><input name="account_name" defaultValue={a?.account_name ?? ''} placeholder="ፍኖተ ጽድቅ ሰንበት ትምህርት ቤት" /></div>
            <div className="field"><label>Telebirr ቁጥር</label><input name="telebirr_number" dir="ltr" defaultValue={a?.telebirr_number ?? ''} /></div>
            <div className="field"><label>CBE ሂሳብ ቁጥር</label><input name="cbe_account" dir="ltr" defaultValue={a?.cbe_account ?? ''} /></div>
          </div>
        </MediaForm>
      </details>

      <h3 className="section">ለማረጋገጥ ({pending.length})</h3>
      <p className="muted small">እያንዳንዱን የግብይት ቁጥር በTelebirr/CBE መግለጫ ላይ ካረጋገጡ በኋላ ብቻ “ተረጋግጧል” ይጫኑ። ሲረጋገጥ ደረሰኝ በራሱ ይዘጋጃል።</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>የተላከበት</th><th>ለጋሽ</th><th className="num">መጠን</th><th>መንገድ</th><th>የግብይት ቁጥር</th><th>ምክንያት</th><th /></tr></thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td>{formatEc(r.created_at)}</td>
                <td>{r.donor_name ?? 'ስም አልባ'}{r.donor_phone && <div className="small muted" dir="ltr">{r.donor_phone}</div>}</td>
                <td className="num">{formatBirr(r.amount)}</td>
                <td>{DONATION_METHOD[r.method]}</td>
                <td dir="ltr"><code>{r.txn_ref}</code></td>
                <td className="small">{r.purpose ?? ''}</td>
                <td>
                  <div className="btn-row">
                    <ActionButton action={verifyDonation.bind(null, r.id)} label="✓ ተረጋግጧል" className="btn sm green"
                      confirmText={`${formatBirr(r.amount)} (${r.txn_ref}) በሂሳቡ ላይ መግባቱን አረጋግጠዋል? ደረሰኝ ይዘጋጃል።`} />
                    <ReasonForm action={rejectDonation} id={r.id} field="reject_reason" button="አልተገኘም" placeholder="ምክንያት" />
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={7} className="muted">የሚጠብቅ የለም።</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="section">የተወሰነባቸው</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ቀን</th><th>ለጋሽ</th><th className="num">መጠን</th><th>መንገድ</th><th>ሁኔታ</th><th>ደረሰኝ</th></tr></thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id}>
                <td>{formatEc(r.decided_at ?? r.created_at)}</td>
                <td>{r.donor_name ?? 'ስም አልባ'}</td>
                <td className="num">{formatBirr(r.amount)}</td>
                <td>{DONATION_METHOD[r.method]}</td>
                <td>
                  <span className={`pill ${r.status === 'verified' ? 'present' : 'absent'}`}>{DONATION_STATUS[r.status]}</span>
                  {r.reject_reason && <div className="small muted">{r.reject_reason}</div>}
                </td>
                <td>{live(r) ? <Link className="link" href={`/staff/receipts/${live(r)!.id}`}>{live(r)!.code}</Link> : '—'}</td>
              </tr>
            ))}
            {done.length === 0 && <tr><td colSpan={6} className="muted">እስካሁን የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function AuditView({ p }: { p?: string }) {
  const period = isPeriod(p) ? p : 'month';
  const supabase = await createClient();
  const range = await resolveRange(supabase, period);
  const { data } = await supabase.from('donations').select(COLS)
    .gte('created_at', `${range.from}T00:00:00+03:00`).lte('created_at', `${range.to}T23:59:59+03:00`)
    .order('created_at');
  const rows = (data ?? []) as unknown as D[];
  const ok = rows.filter((r) => r.status === 'verified' && r.receipts.some((x) => !x.voided_at));
  const sum = (xs: D[]) => xs.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="statement">
      <PeriodTabs base="/staff/audit/donations" active={period} />
      <StatementHeader title="የእርዳታ መዝገብ" subtitle={range.label} />
      <div className="summary-grid">
        <div><span>የተረጋገጠ እርዳታ</span><b className="pos">{formatBirr(sum(ok))}</b></div>
        <div><span>በTelebirr</span><b>{formatBirr(sum(ok.filter((r) => r.method === 'telebirr')))}</b></div>
        <div><span>በCBE</span><b>{formatBirr(sum(ok.filter((r) => r.method === 'cbe')))}</b></div>
        <div><span>በማረጋገጥ ላይ / ያልተገኘ</span><b>{rows.filter((r) => r.status === 'pending').length} / {rows.filter((r) => r.status === 'rejected').length}</b></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ቀን</th><th>ለጋሽ</th><th>መንገድ</th><th>የግብይት ቁጥር</th><th>ሁኔታ</th><th>ደረሰኝ</th><th className="num">መጠን</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const rc = r.receipts.find((x) => !x.voided_at) ?? r.receipts[0];
              return (
                <tr key={r.id}>
                  <td>{formatEc(r.created_at)}</td>
                  <td>{r.donor_name ?? 'ስም አልባ'}</td>
                  <td>{DONATION_METHOD[r.method]}</td>
                  <td dir="ltr"><code>{r.txn_ref}</code></td>
                  <td>{DONATION_STATUS[r.status]}{r.reject_reason ? ` — ${r.reject_reason}` : ''}</td>
                  <td>{rc ? <Link className="link" href={`/staff/audit/receipts?c=${encodeURIComponent(rc.code)}`}>{rc.code}{rc.voided_at ? ' (ተሰርዟል)' : ''}</Link> : '—'}</td>
                  <td className="num">{formatBirr(r.amount)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">በዚህ ጊዜ እርዳታ የለም።</td></tr>}
          </tbody>
          <tfoot><tr><th colSpan={6}>የተረጋገጠ ድምር</th><th className="num">{formatBirr(sum(ok))}</th></tr></tfoot>
        </table>
      </div>
      <StatementSignatures />
    </div>
  );
}
