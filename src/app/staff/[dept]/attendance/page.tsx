import Link from 'next/link';
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
  attendance: { status: string }[];
};

export default async function AttendanceList({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  const types = sessionTypesForDept(dept);
  if (types.length === 0) notFound();

  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from('attendance_sessions')
    .select('id, session_type, session_date, session_time, attendance(status)')
    .in('session_type', types)
    .order('session_date', { ascending: false })
    .order('session_time', { ascending: false })
    .limit(100)
    .returns<SessionRow[]>();

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ክትትል መያዝ</h2>
      <NewSessionForm dept={dept} types={types} />

      <h2 className="section">ያለፉ ክፍለ ጊዜያት</h2>
      {error && <div className="alert error">{error.message}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ቀን</th><th>ሰዓት</th><th>አይነት</th><th>ተገኝቷል</th><th>ግማሽ</th><th>ቀሪ</th><th></th></tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((s) => {
              const n = (st: string) => s.attendance.filter((a) => a.status === st).length;
              return (
                <tr key={s.id}>
                  <td>{formatEc(s.session_date, { weekday: true })}</td>
                  <td dir="ltr">{s.session_time?.slice(0, 5) ?? '—'}</td>
                  <td>{SESSION_TYPES[s.session_type].label}</td>
                  <td>{n('present')}</td>
                  <td>{n('half')}</td>
                  <td>{n('absent')}</td>
                  <td><Link className="link" href={`/staff/${dept}/attendance/${s.id}`}>ክፈት</Link></td>
                </tr>
              );
            })}
            {sessions?.length === 0 && (
              <tr><td colSpan={7} className="muted">እስካሁን ምንም ክፍለ ጊዜ አልተመዘገበም።</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
