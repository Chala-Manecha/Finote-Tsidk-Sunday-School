import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import {
  ATTENDANCE_STATUS, DEPT_NAME, SESSION_TYPES, type AttendanceStatus, type SessionType,
} from '@/lib/constants';
import { PrintButton } from '@/components/print-button';

type AttRow = {
  status: AttendanceStatus;
  attendance_sessions: { id: string; session_type: SessionType; session_date: string; dept: string };
};

/** HR's slim attendance view of one member: per-department counts + absent dates only. */
export default async function MemberAttendance({ params }: { params: Promise<{ id: string }> }) {
  await requireDept('hr', 'office');
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: m }, { data: att }] = await Promise.all([
    supabase.from('members').select('full_name, reg_no').eq('id', id).maybeSingle(),
    supabase.from('attendance')
      .select('status, attendance_sessions!inner(id, session_type, session_date, dept)')
      .eq('member_id', id).returns<AttRow[]>(),
  ]);
  if (!m) notFound();

  const byType = new Map<SessionType, Record<AttendanceStatus, number>>();
  for (const a of att ?? []) {
    const t = a.attendance_sessions.session_type;
    const c = byType.get(t) ?? { present: 0, half: 0, absent: 0 };
    c[a.status]++;
    byType.set(t, c);
  }
  const absences = (att ?? []).filter((a) => a.status === 'absent')
    .sort((a, b) => b.attendance_sessions.session_date.localeCompare(a.attendance_sessions.session_date));

  return (
    <>
      <div className="crumb no-print">
        <Link href="/staff">ሁሉም ክፍሎች</Link> › <Link href="/staff/hr/overview">አጠቃላይ አቴንዳንስ</Link> › {m.full_name}
      </div>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="title" style={{ margin: 0 }}>{m.full_name} <span className="muted small">{m.reg_no}</span></h1>
        <PrintButton />
      </div>

      <h2 className="section">ክትትል በክፍል</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ክፍለ ጊዜ</th><th>ክፍል</th><th>ተገኝቷል</th><th>ግማሽ</th><th>ቀሪ</th></tr></thead>
          <tbody>
            {(Object.keys(SESSION_TYPES) as SessionType[]).map((t) => {
              const c = byType.get(t) ?? { present: 0, half: 0, absent: 0 };
              return (
                <tr key={t}>
                  <td>{SESSION_TYPES[t].label}</td><td>{DEPT_NAME[SESSION_TYPES[t].dept]}</td>
                  <td>{c.present}</td><td>{c.half}</td><td>{c.absent}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="section">የቀረባቸው ቀናት ({absences.length})</h2>
      {absences.length === 0 ? <p className="muted">ምንም የቀረበት ቀን የለም።</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ቀን</th><th>ክፍለ ጊዜ</th><th>ክፍል</th><th>ሁኔታ</th></tr></thead>
            <tbody>
              {absences.map((a) => (
                <tr key={a.attendance_sessions.id}>
                  <td>{formatEc(a.attendance_sessions.session_date, { weekday: true })}</td>
                  <td>{SESSION_TYPES[a.attendance_sessions.session_type].label}</td>
                  <td>{DEPT_NAME[a.attendance_sessions.dept]}</td>
                  <td><span className="pill absent">{ATTENDANCE_STATUS[a.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
