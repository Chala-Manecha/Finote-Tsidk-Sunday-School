import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  DEPT_NAME, ITEM_CONDITION, MEMBER_STATUS, WORK_STATUS, formatBirr, type ItemCondition,
} from '@/lib/constants';
import { EC_MONTHS, daysInEcMonth, ecToIso, formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { PrintButton } from '@/components/print-button';

const PERIODS = { month: { label: 'ወርሃዊ', months: 1 }, quarter: { label: 'ሩብ አመት', months: 3 }, half: { label: 'ግማሽ አመት', months: 6 }, year: { label: 'አመታዊ', months: 12 } } as const;
type Period = keyof typeof PERIODS;

/** The last N Ethiopian months ending with the current one (ጳጉሜ folds into ነሐሴ's period). */
function periodRange(months: number) {
  const today = isoToEc(todayIsoAddis());
  let { year, month } = today;
  if (month === 13) month = 12;
  const endMonth = today.month;
  const endIso = ecToIso({ year: today.year, month: endMonth, day: daysInEcMonth(today.year, endMonth) });
  for (let i = 1; i < months; i++) { month--; if (month < 1) { month = 12; year--; } }
  return { from: ecToIso({ year, month, day: 1 }), to: endIso, label: `${EC_MONTHS[month - 1]} ${year} – ${EC_MONTHS[endMonth - 1]} ${today.year}` };
}

export default async function AuditReports({
  params, searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ p?: string; show?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'audit') notFound();
  const sp = await searchParams;
  const period: Period = sp.p && sp.p in PERIODS ? (sp.p as Period) : 'month';
  const { from, to, label } = periodRange(PERIODS[period].months);
  const supabase = await createClient();

  const [{ data: members }, { data: property }, { data: earnings }, { data: expenses }] = await Promise.all([
    supabase.from('members').select('id, full_name, member_status, work_status, phone, created_at').eq('is_active', true).order('full_name'),
    supabase.from('dept_property').select('id, name, qty, condition, owner_dept'),
    supabase.from('earnings').select('dept, amount, source, earned_on').eq('status', 'approved').gte('earned_on', from).lte('earned_on', to),
    supabase.from('expense_lines').select('amount, reason, spent_on, money_requests(dept)').gte('spent_on', from).lte('spent_on', to),
  ]);

  const m = members ?? [];
  const newInPeriod = m.filter((x) => x.created_at.slice(0, 10) >= from && x.created_at.slice(0, 10) <= to).length;
  const incomeTotal = (earnings ?? []).reduce((s, e) => s + Number(e.amount), 0);
  type Ex = { amount: number; reason: string; spent_on: string; money_requests: { dept: string } | null };
  const ex = (expenses ?? []) as unknown as Ex[];
  const expenseTotal = ex.reduce((s, e) => s + Number(e.amount), 0);

  const show = sp.show;
  const base = `/staff/audit/reports?p=${period}`;
  const card = (key: string, value: React.ReactNode, text: string) => (
    <Link href={show === key ? base : `${base}&show=${key}`} className={`stat-card ${show === key ? 'active' : ''}`}>
      <b>{value}</b>{text}
    </Link>
  );

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>ሪፖርቶች</h2>
        <PrintButton />
      </div>
      <div className="subtabs no-print">
        {(Object.keys(PERIODS) as Period[]).map((k) => (
          <Link key={k} href={`/staff/audit/reports?p=${k}`} className={`btn sm ${k === period ? 'green' : 'secondary'}`}>{PERIODS[k].label}</Link>
        ))}
      </div>
      <p className="muted small">{label}</p>

      <h3 className="section">Human Report</h3>
      <div className="stat-cards">
        {(Object.keys(MEMBER_STATUS) as (keyof typeof MEMBER_STATUS)[]).map((s) =>
          card(`m-${s}`, m.filter((x) => x.member_status === s).length, MEMBER_STATUS[s]))}
        <div className="stat-card"><b>{newInPeriod}</b>በዚህ ጊዜ የተመዘገቡ</div>
      </div>
      {show?.startsWith('m-') && (
        <table>
          <thead><tr><th>ስም</th><th>የአባልነት ሁኔታ</th><th>የስራ ሁኔታ</th><th>ስልክ</th></tr></thead>
          <tbody>
            {m.filter((x) => `m-${x.member_status}` === show).map((x) => (
              <tr key={x.id}>
                <td><Link className="link" href={`/staff/members/${x.id}`}>{x.full_name}</Link></td>
                <td>{MEMBER_STATUS[x.member_status as keyof typeof MEMBER_STATUS]}</td>
                <td>{WORK_STATUS[x.work_status as keyof typeof WORK_STATUS]}</td>
                <td dir="ltr">{x.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="section">Collateral Report</h3>
      <div className="stat-cards">
        {(Object.keys(ITEM_CONDITION) as ItemCondition[]).map((c) =>
          card(`c-${c}`, (property ?? []).filter((p) => p.condition === c).reduce((s, p) => s + p.qty, 0), ITEM_CONDITION[c]))}
      </div>
      {show?.startsWith('c-') && (
        <table>
          <thead><tr><th>ዕቃ</th><th className="num">ብዛት</th><th>ክፍል</th></tr></thead>
          <tbody>
            {(property ?? []).filter((p) => `c-${p.condition}` === show).map((p) => (
              <tr key={p.id}><td>{p.name}</td><td className="num">{p.qty}</td><td>{DEPT_NAME[p.owner_dept]}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="section">Financial Report</h3>
      <div className="stat-cards">
        {card('f-in', formatBirr(incomeTotal), 'ጠቅላላ ገቢ')}
        {card('f-out', formatBirr(expenseTotal), 'ጠቅላላ ወጪ')}
      </div>
      {show === 'f-in' && (
        <table>
          <thead><tr><th>ክፍል</th><th className="num">መጠን</th><th>ምንጭ</th><th>ቀን</th></tr></thead>
          <tbody>
            {(earnings ?? []).map((e, i) => (
              <tr key={i}><td>{DEPT_NAME[e.dept]}</td><td className="num">{formatBirr(e.amount)}</td><td>{e.source}</td><td>{formatEc(e.earned_on)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {show === 'f-out' && (
        <table>
          <thead><tr><th>ክፍል</th><th className="num">መጠን</th><th>ምክንያት</th><th>ቀን</th></tr></thead>
          <tbody>
            {ex.map((e, i) => (
              <tr key={i}><td>{DEPT_NAME[e.money_requests?.dept ?? '']}</td><td className="num">{formatBirr(e.amount)}</td><td>{e.reason}</td><td>{formatEc(e.spent_on)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
