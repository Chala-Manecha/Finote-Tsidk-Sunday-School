import Link from 'next/link';
import { fmtTime } from '@/lib/ethiopian-calendar';
import { notFound } from 'next/navigation';
import { requireStaff, canAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { SESSION_TYPES, type AttendanceStatus, type SessionType } from '@/lib/constants';
import { SessionRoster } from './roster';

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string; sessionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { dept, sessionId } = await params;
  const { saved } = await searchParams;
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('attendance_sessions')
    .select('id, dept, session_type, session_date, session_time, title, attendance(status, member_id, members(full_name))')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session || session.dept !== dept) notFound();

  type A = { status: AttendanceStatus; member_id: string; members: { full_name: string } };
  const rows = (session.attendance as unknown as A[])
    .map((a) => ({ id: a.member_id, full_name: a.members.full_name, status: a.status }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'am'));

  return (
    <>
      <div className="crumb no-print"><Link href={`/staff/${dept}/attendance`}>ክትትል</Link> › ክፍለ ጊዜ</div>
      {saved && <div className="alert ok">ክትትል ተቀምጧል።</div>}
      <h2 className="section" style={{ marginTop: 0 }}>
        {session.title ? `${session.title} · ` : ''}{SESSION_TYPES[session.session_type as SessionType].label} —{' '}
        {formatEc(session.session_date, { weekday: true })}
        {session.session_time ? ` · ${fmtTime(session.session_time)}` : ''}
      </h2>
      <SessionRoster
        dept={dept}
        sessionId={session.id}
        members={rows.map(({ id, full_name }) => ({ id, full_name }))}
        initial={Object.fromEntries(rows.map((r) => [r.id, r.status]))}
        canEdit={canAccess(staff, dept)}
      />
    </>
  );
}
