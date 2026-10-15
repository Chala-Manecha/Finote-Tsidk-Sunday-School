import Link from 'next/link';
import { fmtTime } from '@/lib/ethiopian-calendar';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { SESSION_TYPES, sessionTypesForDept, type SessionType } from '@/lib/constants';
import { NewSessionForm } from './new-session-form';

type SessionRow = {
  id: string;
  session_type: SessionType;
  session_date: string;
  session_time: string | null;
  title: string | null;
  attendance: { status: string }[];
};

export default async function AttendanceList({ params, searchParams }: { params: Promise<{ dept: string }>; searchParams: Promise<{ t?: string }> }) {
  const { dept } = await params;
  const { t } = await searchParams;
  const types = sessionTypesForDept(dept);
  if (types.length === 0) notFound();

  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from('attendance_sessions')
    .select('id, session_type, session_date, session_time, title, attendance(status)')
    .in('session_type', t && types.includes(t as SessionType) ? [t] : types)
    .order('session_date', { ascending: false })
    .order('session_time', { ascending: false })
    .limit(100)
    .returns<SessionRow[]>();

  const list = sessions ?? [];
  const rate = (s: SessionRow) => (s.attendance.length ? Math.round(((s.attendance.filter((a) => a.status === 'present').length + s.attendance.filter((a) => a.status === 'half').length / 2) / s.attendance.length) * 100) : null);
  const rates = list.map(rate).filter((x): x is number => x !== null);
  const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
  const base = `/staff/${dept}/attendance`;

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ክትትል መያዝ</h2>
        {dept === 'education' && (
          <div className="seg no-print"><Link href="/staff/education/abnet">📖 የአብነት ትምህርቶች</Link><Link className="on" href="/staff/education/attendance">🧾 ክትትል መያዝ</Link></div>
        )}
      </div>
      <div className="side-form">
        <NewSessionForm dept={dept} types={types} />
        <section className="card">
          <div className="card-head">
            <b>ያለፉ ክፍለ ጊዜያት</b><span className="count-badge">{list.length}</span>
            {avg !== null && <span className="pill present">አማካይ ተገኝነት {avg}%</span>}
            <span style={{ flex: 1 }} />
            {types.length > 1 && (
              <div className="seg">
                <Link className={!t ? 'on' : ''} href={base}>ሁሉም</Link>
                {types.map((x) => <Link key={x} className={t === x ? 'on' : ''} href={`${base}?t=${x}`}>{SESSION_TYPES[x].label}</Link>)}
              </div>
            )}
          </div>
          {error && <div className="alert error">{error.message}</div>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ቀን</th><th>ሰዓት</th><th>ርዕስ / አይነት</th><th className="num">ተገኝቷል</th><th className="num">ግማሽ</th><th className="num">ቀሪ</th><th className="num">%</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const n = (st: string) => s.attendance.filter((a) => a.status === st).length;
                  const r = rate(s);
                  return (
                    <tr key={s.id}>
                      <td>{formatEc(s.session_date, { weekday: true })}</td>
                      <td dir="ltr" className="small">{fmtTime(s.session_time) || '—'}</td>
                      <td>{s.title ? <><b>{s.title}</b><div className="small muted">{SESSION_TYPES[s.session_type].label}</div></> : SESSION_TYPES[s.session_type].label}</td>
                      <td className="num">{n('present')}</td>
                      <td className="num">{n('half')}</td>
                      <td className="num">{n('absent')}</td>
                      <td className="num"><span className={`pill ${r === null ? '' : r >= 75 ? 'present' : r >= 50 ? 'half' : 'absent'}`}>{r ?? '—'}{r !== null && '%'}</span></td>
                      <td><Link className="btn xs secondary" href={`/staff/${dept}/attendance/${s.id}`}>ክፈት</Link></td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={8} className="muted">እስካሁን ምንም ክፍለ ጊዜ አልተመዘገበም።</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
