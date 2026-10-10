import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchDeptSummaries } from '@/lib/money-data';
import { DEPT_NAME, MONEY_STATUS, STATUS_PILL, formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { DeptMoneySummaryTable } from '@/components/dept-money-summary';
import { PrintButton } from '@/components/print-button';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { setOpeningBalance } from '@/lib/actions/finance';
import { loadWallet, signed } from '@/lib/ledger';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

/** Per-department use of money; ሒሳብና ንብረት also sets the opening balance here. */
export async function UsageView({ dept, d }: { dept: string; d?: string }) {
  const base = `/staff/${dept}/money-report?view=usage`;
  const supabase = await createClient();
  const [{ rows, requests }, wallet] = await Promise.all([fetchDeptSummaries(supabase), loadWallet(supabase)]);
  const after = wallet.movements.filter((m) => !wallet.asOf || m.date >= wallet.asOf);
  const walletIn = after.filter((m) => m.kind !== 'paid').reduce((s, m) => s + m.amount, 0);
  const walletOut = after.filter((m) => m.kind === 'paid').reduce((s, m) => s + m.amount, 0);
  const balance = wallet.opening + after.reduce((s, m) => s + signed(m), 0);
  const selfTotal = rows.reduce((s, r) => s + r.self_contributed, 0);
  const refundTotal = rows.reduce((s, r) => s + r.refund, 0);
  const detail = d ? requests.filter((r) => r.dept === d) : [];

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'flex-end' }}><PrintButton /></div>
      <div className="stat-cards">
        <div className="stat-card"><b>{formatBirr(balance)}</b>የሰንበት ት/ቤቱ ቀሪ ሂሳብ</div>
        <div className="stat-card"><b>{formatBirr(wallet.opening)}</b>መነሻ ሂሳብ{wallet.asOf ? ` (${formatEc(wallet.asOf)})` : ''}</div>
        <div className="stat-card"><b>{formatBirr(walletIn)}</b>ገቢ + ተመላሽ</div>
        <div className="stat-card"><b>{formatBirr(walletOut)}</b>የተከፈለ</div>
        {dept !== 'audit' && <div className="stat-card"><b>{formatBirr(selfTotal)}</b>ጠቅላላ ከራስ ወጪ</div>}
        <div className="stat-card"><b>{formatBirr(refundTotal)}</b>ጠቅላላ ተመላሽ</div>
      </div>
      {dept === 'finance' && (
      <details className="card no-print" style={{ marginBottom: 12 }}>
        <summary><b>መነሻ ሂሳብ (Opening balance)</b> <span className="small muted">— ክትትል ሲጀመር በሰንበት ት/ቤቱ እጅ የነበረው ገንዘብ</span></summary>
        <MediaForm action={setOpeningBalance} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
          <div className="form-grid">
            <div className="field"><label>መጠን (ብር)</label><input name="opening_balance" type="number" min={0} step="0.01" defaultValue={wallet.opening} required /></div>
            <div className="field"><span className="label">ከዚህ ቀን ጀምሮ (ዓ.ም)</span><EcDatePicker name="as_of" defaultIso={wallet.asOf ?? todayIsoAddis()} yearsBack={5} yearsForward={0} required /></div>
          </div>
        </MediaForm>
      </details>
      )}
      <DeptMoneySummaryTable rows={rows} detailHref={(x) => `${base}&d=${x}`} showSelf={dept !== 'audit'} />

      {d && (
        <>
          <h2 className="section">
            {DEPT_NAME[d]} — ዝርዝር <Link className="link small no-print" href={base}>ዝጋ</Link>
          </h2>
          {detail.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 12 }}>
              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <b>{r.reason}</b>
                <span className={`pill ${STATUS_PILL[r.status]}`}>{MONEY_STATUS[r.status]}</span>
              </div>
              <p className="small muted" style={{ margin: '4px 0' }}>
                የጸደቀ {formatBirr(r.amount)} · የወጣ {formatBirr(r.spent)} · ተመላሽ {formatBirr(r.refund)}{dept !== 'audit' && ` · ከራስ ወጪ ${formatBirr(r.self_contributed)}`}
              </p>
              {r.lines.length > 0 ? (
                <table>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={l.id}><td>{formatEc(l.spent_on)}</td><td className="num">{formatBirr(l.amount)}</td><td>{l.reason}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="small muted">የወጪ መስመር አልተመዘገበም።</p>}
            </div>
          ))}
          {detail.length === 0 && <p className="muted">የጸደቀ ጥያቄ የለም።</p>}
        </>
      )}
    </>
  );
}
