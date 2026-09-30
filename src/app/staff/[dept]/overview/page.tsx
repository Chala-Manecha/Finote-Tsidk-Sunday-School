import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EC_MONTHS, ecMonthRange, isoToEc, todayIsoAddis, ecToIso } from '@/lib/ethiopian-calendar';
import { DEPT_NAME, SESSION_TYPES, type SessionType } from '@/lib/constants';
import { PrintButton } from '@/components/print-button';

type Overview = {
  session_type: SessionType; dept: string; sessions: number; records: number;
  absent: number; half: number; present: number; absent_pct: number;
};
type Absence = { member_id: string; full_name: string; absent_days: number; half_days: number; absent_dept_count: number };

export default async function HrOverview({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ m?: string; y?: string; q?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const sp = await searchParams;

  const now = isoToEc(todayIsoAddis());
  const month = Number(sp.m) || now.month;
  const year = Number(sp.y) || now.year;
  const { from, to } = ecMonthRange(ecToIso({ year, month, day: 1 }));

  const supabase = await createClient();
  const [r1, r2] = await Promise.all([
    supabase.rpc('attendance_overview', { p_from: from, p_to: to }),
    supabase.rpc('member_absence_summary', { p_from: from, p_to: to }),
  ]);
  const overview = r1.data as Overview[] | null;
  const absences = r2.data as Absence[] | null;
  const e1 = r1.error;
  const e2 = r2.error;

  const q = sp.q?.trim();
  const list = (absences ?? []).filter((a) => !q || a.full_name.includes(q));

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የተዋሃደ ክትትል</h2>
        <PrintButton />
      </div>
      <form className="toolbar no-print" action="/staff/hr/overview">
        <div className="field">
          <label htmlFor="m">ወር</label>
          <select id="m" name="m" defaultValue={month}>
            {EC_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="y">ዓ.ም</label>
          <input id="y" name="y" type="number" defaultValue={year} style={{ width: 100 }} />
        </div>
        <button className="btn sm">አሳይ</button>
      </form>
      <p className="muted small">{EC_MONTHS[month - 1]} {year} ዓ.ም</p>

      {(e1 || e2) && <div className="alert error">{e1?.message ?? e2?.message}</div>}
      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr><th>ክፍለ ጊዜ</th><th>የሚይዘው ክፍል</th><th>ክፍለ ጊዜያት</th><th>ተገኝቷል</th><th>ግማሽ</th><th>ቀሪ</th><th>የቀሪዎች ዳታ</th></tr>
          </thead>
          <tbody>
            {(overview ?? []).map((o) => (
              <tr key={o.session_type}>
                <td>{SESSION_TYPES[o.session_type].label}</td>
                <td>{DEPT_NAME[o.dept]}</td>
                <td>{o.sessions}</td>
                <td>{o.present}</td>
                <td>{o.half}</td>
                <td>{o.absent}</td>
                <td><b>{o.absent_pct}%</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section">የአባል ክትትል ፍለጋ</h2>
      <form className="toolbar no-print" action="/staff/hr/overview">
        <input type="hidden" name="m" value={month} />
        <input type="hidden" name="y" value={year} />
        <div className="field">
          <label htmlFor="q">ስም</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <button className="btn sm">ፈልግ</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ስም</th><th>ቀሪ ቀናት ብዛት</th><th>ግማሽ</th><th>የቀረበት ክፍል</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.member_id}>
                <td><Link className="link" href={`/staff/members/${a.member_id}`}>{a.full_name}</Link></td>
                <td>{a.absent_days}</td>
                <td>{a.half_days}</td>
                <td>
                  {a.absent_dept_count > 0
                    ? <Link className="link" href={`/staff/members/${a.member_id}`}>{a.absent_dept_count}</Link>
                    : 0}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="muted">ምንም አልተገኘም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
