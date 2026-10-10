import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, DEPT_NAME, formatBirr } from '@/lib/constants';
import { isPeriod, resolveRange } from '@/lib/periods';
import { loadWallet, contributions } from '@/lib/ledger';
import { StatementHeader, StatementSignatures, PeriodTabs } from '@/components/statement';

type Prop = { dept: string; added: number; maintained: number; lost: number; net: number };

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatBirr(Math.abs(n));
const cls = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

/** Row highlight: best = top, worst (only if it differs from the best) = bottom. */
function marks<T extends { net: number }>(rows: T[]) {
  const max = Math.max(...rows.map((r) => r.net));
  const min = Math.min(...rows.map((r) => r.net));
  return (r: T) => (rows.length < 2 || max === min ? '' : r.net === max ? 'top' : r.net === min ? 'bottom' : '');
}

export default async function AuditRanking({
  params, searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'audit') notFound();
  const { p } = await searchParams;
  const period = isPeriod(p) ? p : 'month';
  const supabase = await createClient();
  const range = await resolveRange(supabase, period);
  const depts = DEPARTMENTS.map((d) => d.code as string);

  const [wallet, { data: logs }] = await Promise.all([
    loadWallet(supabase),
    supabase.from('property_log').select('dept, kind, value').gte('log_date', range.from).lte('log_date', range.to),
  ]);
  // ከራስ ወጪ is not part of the audit view: net = ያስገኘው ገቢ − የጠየቀው ወጪ.
  const money = contributions(wallet, range.from, range.to, depts)
    .map((r) => ({ ...r, net: r.income - r.netOut }))
    .sort((a, b) => b.net - a.net);

  const propMap = new Map<string, Prop>(depts.map((d) => [d, { dept: d, added: 0, maintained: 0, lost: 0, net: 0 }]));
  for (const l of logs ?? []) {
    const r = propMap.get(l.dept);
    if (!r) continue;
    r[l.kind as 'added' | 'maintained' | 'lost'] += Number(l.value);
  }
  for (const r of propMap.values()) r.net = r.added + r.maintained - r.lost;
  const property = [...propMap.values()].sort((a, b) => b.net - a.net);

  const mMark = marks(money);
  const pMark = marks(property);
  const tot = money.reduce((s, r) => ({ income: s.income + r.income, out: s.out + r.netOut, net: s.net + r.net }),
    { income: 0, out: 0, net: 0 });
  const ptot = property.reduce((s, r) => ({ a: s.a + r.added, m: s.m + r.maintained, l: s.l + r.lost, n: s.n + r.net }), { a: 0, m: 0, l: 0, n: 0 });

  const best = money[0];
  const worst = money[money.length - 1];

  return (
    <div className="statement">
      <PeriodTabs base="/staff/audit/contributions" active={period} />
      <StatementHeader title="የክፍላት ገቢ ወጪ" subtitle={range.label} />

      {best && worst && best.net !== worst.net && (
        <div className="summary-grid">
          <div><span>🏆 ከፍተኛ አስተዋጽኦ (ገንዘብ)</span><b className="pos">{DEPT_NAME[best.dept]}</b></div>
          <div><span>ዝቅተኛ አስተዋጽኦ (ገንዘብ)</span><b className="neg">{DEPT_NAME[worst.dept]}</b></div>
          <div><span>የሁሉም ክፍላት የተጣራ አስተዋጽኦ</span><b className={cls(tot.net)}>{sign(tot.net)}</b></div>
        </div>
      )}

      <h3 className="serif">1. የገንዘብ አስተዋጽኦ</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank">ተ.ቁ</th><th>ክፍል</th>
              <th className="num">ያስገኘው ገቢ</th>
              <th className="num">የጠየቀው ወጪ</th><th className="num">የተጣራ አስተዋጽኦ</th>
            </tr>
          </thead>
          <tbody>
            {money.map((r, i) => (
              <tr key={r.dept} className={mMark(r)}>
                <td className="rank">{i + 1}</td>
                <td>{DEPT_NAME[r.dept]}{mMark(r) === 'top' ? ' ★' : ''}</td>
                <td className="num">{formatBirr(r.income)}</td>
                <td className="num">{formatBirr(r.netOut)}</td>
                <td className={`num ${cls(r.net)}`}>{sign(r.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th /><th>ድምር</th>
              <th className="num">{formatBirr(tot.income)}</th>
              <th className="num">{formatBirr(tot.out)}</th><th className={`num ${cls(tot.net)}`}>{sign(tot.net)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted">
        የተጣራ አስተዋጽኦ = ያስገኘው ገቢ (በሒሳብና ንብረት የጸደቀ) − የጠየቀው ወጪ (ከሰንበት ት/ቤቱ የተከፈለ − ተመላሽ)።
      </p>

      <h3 className="serif">2. የንብረት አስተዋጽኦ</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank">ተ.ቁ</th><th>ክፍል</th>
              <th className="num">ንብረት በመጨመር (+)</th><th className="num">ንብረት አያያዝ (+)</th>
              <th className="num">የጎደለ ንብረት (−)</th><th className="num">የተጣራ</th>
            </tr>
          </thead>
          <tbody>
            {property.map((r, i) => (
              <tr key={r.dept} className={pMark(r)}>
                <td className="rank">{i + 1}</td>
                <td>{DEPT_NAME[r.dept]}{pMark(r) === 'top' ? ' ★' : ''}</td>
                <td className="num">{formatBirr(r.added)}</td>
                <td className="num">{formatBirr(r.maintained)}</td>
                <td className="num">{formatBirr(r.lost)}</td>
                <td className={`num ${cls(r.net)}`}>{sign(r.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th /><th>ድምር</th>
              <th className="num">{formatBirr(ptot.a)}</th><th className="num">{formatBirr(ptot.m)}</th>
              <th className="num">{formatBirr(ptot.l)}</th><th className={`num ${cls(ptot.n)}`}>{sign(ptot.n)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted">በሒሳብና ንብረት ከጸደቀው አዲስ ንብረት የተወሰደ (በዋጋ)።</p>

      <StatementSignatures />
    </div>
  );
}
