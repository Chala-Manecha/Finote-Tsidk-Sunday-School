import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, DEPT_NAME, GENERAL_DONATIONS, formatBirr } from '@/lib/constants';
import Link from 'next/link';
import { EC_MONTHS, formatEc, isoToEc } from '@/lib/ethiopian-calendar';
import { AutoSubmit } from '@/components/auto-submit';
import { PERIODS, isPeriod, resolveRange, type Period } from '@/lib/periods';
import { loadWallet, signed } from '@/lib/ledger';
import { StatementHeader, StatementSignatures } from '@/components/statement';
import { RequestsTable } from '@/components/requests-table';
import { BalanceCard } from '@/components/balance-card';

const KIND = { income: 'ገቢ', paid: 'ወጪ (ተከፈለ)', refund: 'ተመላሽ' } as const;

/** ገቢ፣ ወጪ እና ቀሪ ሂሳብ statement (ሒሳብና ንብረት and ኦዲት). */
export async function LedgerView({ dept, sp }: { dept: string; sp: { p?: string; d?: string; k?: string } }) {
  const kind = sp.k === 'in' || sp.k === 'out' || sp.k === 'bal' ? sp.k : 'all';
  const period = isPeriod(sp.p) ? sp.p : 'month';
  const filterDept = sp.d && (sp.d in DEPT_NAME || sp.d === 'general') ? sp.d : undefined;
  const supabase = await createClient();
  const range = await resolveRange(supabase, period);
  const wallet = await loadWallet(supabase);
  // Clean payments are audited automatically; ኦዲት only gets the exceptions.
  const LATE_DAYS = 30;
  const today = new Date().toISOString().slice(0, 10);
  const daysSince = (iso: string) => Math.floor((Date.parse(today) - Date.parse(iso.slice(0, 10))) / 86400000);
  const why = (r: (typeof wallet.requests)[number]): string | null => {
    if (r.status !== 'paid' || r.audited_at) return null;
    if (r.audit_flag) return 'ምልክት የተደረገበት';
    if (r.self_contributed > 0) return `ከተሰጠው በላይ ወጪ (${formatBirr(r.self_contributed)})`;
    if (r.received_at && !r.spend_approved_at && daysSince(r.received_at) > LATE_DAYS) return `ከ${LATE_DAYS} ቀን በላይ የወጪ ሪፖርት አልቀረበም`;
    return null;
  };
  const toReview = wallet.requests.filter((r) => why(r));
  const autoCount = wallet.requests.filter((r) => r.audited_at && r.auto_audited).length;

  // Wallet balance is school-wide; the department filter only narrows the rows.
  const startFrom = wallet.asOf ?? '0000-01-01';
  const before = wallet.movements.filter((m) => m.date >= startFrom && m.date < range.from);
  const inside = wallet.movements.filter((m) => m.date >= range.from && m.date <= range.to && m.date >= startFrom);
  const openingForPeriod = wallet.opening + before.reduce((s, m) => s + signed(m), 0);
  const totalIn = inside.filter((m) => m.kind !== 'paid').reduce((s, m) => s + m.amount, 0);
  const totalOut = inside.filter((m) => m.kind === 'paid').reduce((s, m) => s + m.amount, 0);
  const closing = openingForPeriod + totalIn - totalOut;

  const balances = inside.reduce<number[]>((acc, m) => { acc.push((acc.at(-1) ?? openingForPeriod) + signed(m)); return acc; }, []);
  const rows = inside.map((m, i) => ({ ...m, balance: balances[i] }))
    .filter((m) => !filterDept || m.dept === filterDept)
    .filter((m) => kind === 'in' ? m.kind !== 'paid' : kind === 'out' ? m.kind === 'paid' : true);
  // ቀሪ ሂሳብ: month by month (Ethiopian months)
  const months: { key: string; label: string; inn: number; out: number; end: number }[] = [];
  inside.forEach((m, i) => {
    const e = isoToEc(m.date);
    const key = `${e.year}-${String(e.month).padStart(2, '0')}`;
    let row = months.find((x) => x.key === key);
    if (!row) { row = { key, label: `${EC_MONTHS[e.month - 1]} ${e.year}`, inn: 0, out: 0, end: 0 }; months.push(row); }
    if (m.kind === 'paid') row.out += m.amount; else row.inn += m.amount;
    row.end = balances[i];
  });

  const base = `/staff/${dept}/money-report`;
  return (
    <div className="statement">
      <div className="report-bar no-print">
        <div className="money-tabs sm">
          {([['all', 'ሁሉም'], ['in', 'ገቢ'], ['out', 'ወጪ'], ['bal', 'ቀሪ ሂሳብ']] as const).map(([k, l]) => (
            <Link key={k} scroll={false} href={`${base}?p=${period}${filterDept ? `&d=${filterDept}` : ''}${k === 'all' ? '' : `&k=${k}`}`} className={kind === k ? 'on' : ''}>{l}</Link>
          ))}
        </div>
        <form className="toolbar slim" action={base}>
          {kind !== 'all' && <input type="hidden" name="k" value={kind} />}
          <select name="p" defaultValue={period} aria-label="ጊዜ">
            {(Object.keys(PERIODS) as Period[]).map((k) => <option key={k} value={k}>{PERIODS[k].label}</option>)}
          </select>
          <select name="d" defaultValue={filterDept ?? ''} aria-label="ክፍል">
            <option value="">ሁሉም ክፍሎች</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            <option value="general">{GENERAL_DONATIONS}</option>
          </select>
          <AutoSubmit />
        </form>
        <span className="small muted">{range.label}</span>
      </div>

      <div className="print-only"><StatementHeader title="የገንዘብ እንቅስቃሴ መግለጫ" subtitle={`${range.label}${filterDept ? ` · ${DEPT_NAME[filterDept] ?? GENERAL_DONATIONS}` : ''}`} /></div>

      <div className="money-tiles slim">
        <div className="mt-open"><span>መነሻ ቀሪ ሂሳብ</span><b>{formatBirr(openingForPeriod)}</b></div>
        <div className="mt-in"><span>＋ ገቢ (ገቢ + ተመላሽ)</span><b>{formatBirr(totalIn)}</b></div>
        <div className="mt-out"><span>− ወጪ</span><b>{formatBirr(totalOut)}</b></div>
        <div className="mt-bal"><span>= ቀሪ ሂሳብ</span><b>{formatBirr(closing)}</b></div>
      </div>
      {!wallet.asOf && (
        <p className="alert error no-print">የመነሻ ቀሪ ሂሳብ ገና አልተመዘገበም — ሒሳብና ንብረት ከላይ በቀኝ ባለው “+ መነሻ ሂሳብ አስገባ” ያስገቡ።</p>
      )}

      {kind === 'bal' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ወር</th><th className="num">ገቢ</th><th className="num">ወጪ</th><th className="num">ልዩነት</th><th className="num">የወሩ መዝጊያ ቀሪ ሂሳብ</th></tr></thead>
            <tbody>
              {months.map((x) => (
                <tr key={x.key}>
                  <td>{x.label}</td>
                  <td className="num pos">{formatBirr(x.inn)}</td>
                  <td className="num neg">{formatBirr(x.out)}</td>
                  <td className={`num ${x.inn - x.out < 0 ? 'neg' : 'pos'}`}>{formatBirr(x.inn - x.out)}</td>
                  <td className="num"><b>{formatBirr(x.end)}</b></td>
                </tr>
              ))}
              {months.length === 0 && <tr><td colSpan={5} className="muted">በዚህ ጊዜ ምንም እንቅስቃሴ የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ቀን</th><th>ክፍል</th><th>ዝርዝር</th><th>አይነት</th>{kind !== 'out' && <th className="num">ገቢ</th>}{kind !== 'in' && <th className="num">ወጪ</th>}{kind === 'all' && <th className="num">ቀሪ ሂሳብ</th>}</tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td>{formatEc(m.date)}</td>
                <td>{DEPT_NAME[m.dept] ?? GENERAL_DONATIONS}</td>
                <td>{m.description}</td>
                <td className="small">{KIND[m.kind]}</td>
                {kind !== 'out' && <td className="num pos">{m.kind !== 'paid' ? formatBirr(m.amount) : ''}</td>}
                {kind !== 'in' && <td className="num neg">{m.kind === 'paid' ? formatBirr(m.amount) : ''}</td>}
                {kind === 'all' && <td className="num">{formatBirr(m.balance)}</td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">በዚህ ጊዜ ምንም እንቅስቃሴ የለም።</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>ድምር</td>
              {kind !== 'out' && <td className="num">{formatBirr(rows.filter((m) => m.kind !== 'paid').reduce((s, m) => s + m.amount, 0))}</td>}
              {kind !== 'in' && <td className="num">{formatBirr(rows.filter((m) => m.kind === 'paid').reduce((s, m) => s + m.amount, 0))}</td>}
              {kind === 'all' && <td className="num">{formatBirr(closing)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
      )}
      <p className="small muted">
        ቀሪ ሂሳብ = መነሻ ቀሪ + የጸደቀ ገቢ − የተከፈለ ገንዘብ + የተመለሰ ተመላሽ።{dept !== 'audit' && ' ከራስ ወጪ ከሰንበት ትምህርት ቤቱ ካዝና ስላልወጣ እዚህ አይቆጠርም።'}
      </p>
      <StatementSignatures />
      {dept === 'audit' && (
        <div className="no-print" style={{ marginTop: 24 }}>
          <BalanceCard supabase={supabase} />
          <h3 className="section">ኦዲት የሚያስፈልጋቸው ክፍያዎች ({toReview.length})</h3>
          <p className="muted small">
            ክፍሉ የተሰጠውን ገንዘብ በትክክል የተጠቀመበትና ተመላሹን የመለሰበት ክፍያ በራሱ ኦዲት ይደረጋል{autoCount > 0 ? ` (እስካሁን ${autoCount})` : ''}።
            እዚህ የሚታዩት ልዩ ሁኔታዎች ብቻ ናቸው — ተመልክተው “✓ ተመልክቻለሁ” ይጫኑ ወይም ምልክት ያድርጉ።
          </p>
          {toReview.length > 0 ? (
            <>
              <ul className="small" style={{ marginTop: 0 }}>
                {toReview.map((r) => <li key={r.id}><b>{DEPT_NAME[r.dept]}</b> — {r.reason}: <span className="neg">{why(r)}</span></li>)}
              </ul>
              <RequestsTable rows={toReview} mode="audit" />
            </>
          ) : <p className="muted">ምንም ልዩ ሁኔታ የለም። ✓</p>}
        </div>
      )}
    </div>
  );
}
