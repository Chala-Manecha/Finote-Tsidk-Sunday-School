import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchDeptSummaries } from '@/lib/money-data';
import { DEPT_NAME, MONEY_STATUS, STATUS_PILL, formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { DeptMoneySummaryTable } from '@/components/dept-money-summary';
import { PrintButton } from '@/components/print-button';
import { loadWallet, signed } from '@/lib/ledger';

/** Per-department use of money (the opening balance is set from the report header). */
export async function UsageView({ dept, d }: { dept: string; d?: string }) {
  const base = `/staff/${dept}/money-usage`;
  const supabase = await createClient();
  const [{ rows, requests }, wallet] = await Promise.all([fetchDeptSummaries(supabase), loadWallet(supabase)]);
  const after = wallet.movements.filter((m) => !wallet.asOf || m.date >= wallet.asOf);
  const walletIn = after.filter((m) => m.kind !== 'paid').reduce((s, m) => s + m.amount, 0);
  const walletOut = after.filter((m) => m.kind === 'paid').reduce((s, m) => s + m.amount, 0);
  const balance = wallet.opening + after.reduce((s, m) => s + signed(m), 0);
  const selfTotal = rows.reduce((s, r) => s + r.self_contributed, 0);
  const refundTotal = rows.reduce((s, r) => s + r.refund, 0);
  const detail = d ? requests.filter((r) => r.dept === d) : [];

  const { data: earn } = d
    ? await supabase.from('earnings').select('id, amount, source, earned_on').eq('dept', d).eq('status', 'approved').order('earned_on', { ascending: false })
    : { data: [] };
  const earnings = ((earn ?? []) as { id: string; amount: number | string; source: string; earned_on: string }[]).map((e) => ({ ...e, amount: Number(e.amount) }));
  const sumRow = d ? rows.find((r) => r.dept === d) : undefined;

  // One department's detail replaces the summary (no scrolling down to find it)
  if (d) {
    return (
      <>
        <div className="page-bar no-print">
          <Link className="back-pill" href={base}>← ሁሉም ክፍሎች</Link>
          <b className="serif" style={{ fontSize: '1.1rem' }}>{DEPT_NAME[d] ?? d}</b>
          <span className="spacer" />
          <PrintButton />
        </div>
        <div className="money-tiles">
          <div className="mt-open"><span>የጸደቀ</span><b>{formatBirr(sumRow?.approved ?? 0)}</b></div>
          <div className="mt-out"><span>የወጣ</span><b>{formatBirr(sumRow?.spent ?? 0)}</b></div>
          <div className="mt-in"><span>ተመላሽ</span><b>{formatBirr(sumRow?.refund ?? 0)}</b></div>
          <div className="mt-bal"><span>ገቢ</span><b>{formatBirr(sumRow?.earned ?? 0)}</b></div>
        </div>
        <div className="card-head"><b>💸 የወጪ ጥያቄዎች</b><span className="count-badge">{detail.length}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ምክንያት</th><th>ሁኔታ</th><th className="num">የጸደቀ</th><th className="num">የወጣ</th><th className="num">ተመላሽ</th>{dept !== 'audit' && <th className="num">ከራስ ወጪ</th>}<th>የወጪ መስመሮች</th></tr></thead>
            <tbody>
              {detail.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.reason}</b><div className="small muted">{formatEc(r.requested_at)}</div></td>
                  <td><span className={`pill ${STATUS_PILL[r.status]}`}>{MONEY_STATUS[r.status]}</span></td>
                  <td className="num">{formatBirr(r.amount)}</td>
                  <td className="num">{formatBirr(r.spent)}</td>
                  <td className="num">{formatBirr(r.refund)}</td>
                  {dept !== 'audit' && <td className="num">{formatBirr(r.self_contributed)}</td>}
                  <td className="small">{r.lines.length
                    ? r.lines.map((l) => <div key={l.id}>{formatEc(l.spent_on)} · {formatBirr(l.amount)} · {l.reason}</div>)
                    : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {detail.length === 0 && <tr><td colSpan={7} className="muted">የጸደቀ የወጪ ጥያቄ የለም።</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-head" style={{ marginTop: 16 }}><b>💰 ገቢ</b><span className="count-badge">{earnings.length}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ቀን</th><th>ምንጭ</th><th className="num">መጠን</th></tr></thead>
            <tbody>
              {earnings.map((e) => <tr key={e.id}><td>{formatEc(e.earned_on)}</td><td>{e.source}</td><td className="num pos">{formatBirr(e.amount)}</td></tr>)}
              {earnings.length === 0 && <tr><td colSpan={3} className="muted">የጸደቀ ገቢ የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="money-tiles">
        <div className="mt-bal"><span>የሰንበት ት/ቤቱ ቀሪ ሂሳብ</span><b>{formatBirr(balance)}</b></div>
        <div className="mt-open"><span>መነሻ ሂሳብ{wallet.asOf ? ` (${formatEc(wallet.asOf)})` : ''}</span><b>{formatBirr(wallet.opening)}</b></div>
        <div className="mt-in"><span>ገቢ + ተመላሽ</span><b>{formatBirr(walletIn)}</b></div>
        <div className="mt-out"><span>የተከፈለ</span><b>{formatBirr(walletOut)}</b></div>
      </div>
      <p className="small muted">ጠቅላላ ተመላሽ፦ <b>{formatBirr(refundTotal)}</b>{dept !== 'audit' && <> · ጠቅላላ ከራስ ወጪ፦ <b>{formatBirr(selfTotal)}</b></>} · የአንድን ክፍል ዝርዝር ለማየት “ዝርዝር” ይጫኑ።</p>
      <DeptMoneySummaryTable rows={rows} detailHref={(x) => `${base}?d=${x}`} showSelf={dept !== 'audit'} />
    </>
  );
}
