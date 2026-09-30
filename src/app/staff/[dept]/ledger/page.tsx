import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, DEPT_NAME, formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { isPeriod, resolveRange } from '@/lib/periods';
import { loadWallet, signed } from '@/lib/ledger';
import { StatementHeader, StatementSignatures, PeriodTabs } from '@/components/statement';

const KIND = { income: 'ገቢ', paid: 'ወጪ (ተከፈለ)', refund: 'ተመላሽ' } as const;

export default async function AuditLedger({
  params, searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ p?: string; d?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'audit' && dept !== 'finance') notFound();
  const sp = await searchParams;
  const period = isPeriod(sp.p) ? sp.p : 'month';
  const filterDept = sp.d && sp.d in DEPT_NAME ? sp.d : undefined;
  const supabase = await createClient();
  const range = await resolveRange(supabase, period);
  const wallet = await loadWallet(supabase);

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
    .filter((m) => !filterDept || m.dept === filterDept);

  const base = `/staff/${dept}/ledger`;
  return (
    <div className="statement">
      <PeriodTabs base={base} active={period} extra={filterDept ? `&d=${filterDept}` : ''} />
      <form className="toolbar no-print" action={base}>
        <input type="hidden" name="p" value={period} />
        <div className="field">
          <label htmlFor="d">ክፍል</label>
          <select id="d" name="d" defaultValue={filterDept ?? ''}>
            <option value="">ሁሉም ክፍሎች</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <button className="btn sm">አጣራ</button>
      </form>

      <StatementHeader title="የገንዘብ እንቅስቃሴ መግለጫ" subtitle={`${range.label}${filterDept ? ` · ${DEPT_NAME[filterDept]}` : ''}`} />

      <div className="summary-grid">
        <div><span>የጊዜው መነሻ ቀሪ ሂሳብ</span><b>{formatBirr(openingForPeriod)}</b></div>
        <div><span>ጠቅላላ ገቢ (ገቢ + ተመላሽ)</span><b className="pos">{formatBirr(totalIn)}</b></div>
        <div><span>ጠቅላላ ወጪ</span><b className="neg">{formatBirr(totalOut)}</b></div>
        <div><span>የጊዜው መዝጊያ ቀሪ ሂሳብ</span><b>{formatBirr(closing)}</b></div>
      </div>
      {!wallet.asOf && (
        <p className="alert error no-print">የመነሻ ቀሪ ሂሳብ ገና አልተመዘገበም — ሒሳብና ንብረት በ&quot;የገንዘብ ክትትል&quot; ገጽ ያስገቡ።</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ቀን</th><th>ክፍል</th><th>ዝርዝር</th><th>አይነት</th><th className="num">ገቢ</th><th className="num">ወጪ</th><th className="num">ቀሪ ሂሳብ</th></tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td>{formatEc(m.date)}</td>
                <td>{DEPT_NAME[m.dept]}</td>
                <td>{m.description}</td>
                <td className="small">{KIND[m.kind]}</td>
                <td className="num pos">{m.kind !== 'paid' ? formatBirr(m.amount) : ''}</td>
                <td className="num neg">{m.kind === 'paid' ? formatBirr(m.amount) : ''}</td>
                <td className="num">{formatBirr(m.balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">በዚህ ጊዜ ምንም እንቅስቃሴ የለም።</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>ድምር</td>
              <td className="num">{formatBirr(rows.filter((m) => m.kind !== 'paid').reduce((s, m) => s + m.amount, 0))}</td>
              <td className="num">{formatBirr(rows.filter((m) => m.kind === 'paid').reduce((s, m) => s + m.amount, 0))}</td>
              <td className="num">{formatBirr(closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted">
        ቀሪ ሂሳብ = መነሻ ቀሪ + የጸደቀ ገቢ − የተከፈለ ገንዘብ + የተመለሰ ተመላሽ። ከራስ ወጪ ከሰንበት ትምህርት ቤቱ ካዝና ስላልወጣ እዚህ አይቆጠርም፤ በክፍላት ደረጃ ግን እንደ አስተዋጽኦ ይቆጠራል።
      </p>
      <StatementSignatures />
    </div>
  );
}
