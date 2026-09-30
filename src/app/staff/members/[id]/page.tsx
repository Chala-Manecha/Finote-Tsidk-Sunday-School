import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ageFromIso, formatEc } from '@/lib/ethiopian-calendar';
import {
  ATTENDANCE_STATUS, DEPT_NAME, GEEZ_LEVEL, MEMBER_STATUS, SESSION_TYPES, SEX, TITLES, WORK_STATUS,
  type AttendanceStatus, type SessionType,
} from '@/lib/constants';
import { PrintButton } from '@/components/print-button';

type AttRow = {
  status: AttendanceStatus;
  attendance_sessions: { id: string; session_type: SessionType; session_date: string; session_time: string | null; dept: string };
};

export default async function MemberDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireDept('hr', 'office');
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const [{ data: m }, { data: att }] = await Promise.all([
    supabase.from('members').select('*, member_departments(dept)').eq('id', id).maybeSingle(),
    supabase
      .from('attendance')
      .select('status, attendance_sessions!inner(id, session_type, session_date, session_time, dept)')
      .eq('member_id', id)
      .returns<AttRow[]>(),
  ]);
  if (!m) notFound();

  // Attendance broken down by session type (each belongs to a department)
  const byType = new Map<SessionType, Record<AttendanceStatus, number>>();
  for (const a of att ?? []) {
    const t = a.attendance_sessions.session_type;
    const c = byType.get(t) ?? { present: 0, half: 0, absent: 0 };
    c[a.status]++;
    byType.set(t, c);
  }
  const absences = (att ?? [])
    .filter((a) => a.status === 'absent')
    .sort((a, b) => b.attendance_sessions.session_date.localeCompare(a.attendance_sessions.session_date));

  const signed = async (path?: string | null) =>
    path ? (await supabase.storage.from('member-docs').createSignedUrl(path, 600)).data?.signedUrl : null;
  const priorUrl = await signed(m.prior_school?.evidence_path);
  const secularUrl = await signed(m.secular_school?.evidence_path);

  const rows: [string, React.ReactNode][] = [
    ['ፆታ', SEX[m.sex as keyof typeof SEX]],
    ['ማዕረግ', m.title ? TITLES[m.title as keyof typeof TITLES] : '—'],
    ['ሁኔታ', WORK_STATUS[m.work_status as keyof typeof WORK_STATUS]],
    ['የአባልነት ሁኔታ', MEMBER_STATUS[m.member_status as keyof typeof MEMBER_STATUS]],
    ['የትውልድ ቀን', m.dob ? `${formatEc(m.dob)} (ዕድሜ ${ageFromIso(m.dob)})` : '—'],
    ['ስልክ', m.phone ?? '—'],
    ['Email', m.email ?? '—'],
    ['Telegram', m.telegram_username ? `@${m.telegram_username}` : '—'],
    ['ክፍለ ከተማ', m.sub_city ?? '—'],
    ['ቋንቋ', m.language ?? '—'],
    ['የግዕዝ ችሎታ', GEEZ_LEVEL[m.geez_level as keyof typeof GEEZ_LEVEL]],
    ['ዜግነት', m.is_ethiopian ? 'ኢትዮጵያዊ' : m.nationality],
    ['ቀድሞ ሰ/ት/ቤት', m.prior_school
      ? <>{m.prior_school.name} · {m.prior_school.years ?? '—'} ዓመት {priorUrl && <a className="link" href={priorUrl} target="_blank">ማስረጃ</a>}</>
      : '—'],
    ['አለማዊ ትምህርት', m.secular_school
      ? <>{m.secular_school.name} {secularUrl && <a className="link" href={secularUrl} target="_blank">ማስረጃ</a>}</>
      : '—'],
    ['የመረጡት ክፍል', m.member_departments.map((d: { dept: string }) => DEPT_NAME[d.dept]).join('፣ ') || '—'],
    ['የተመዘገበበት', formatEc(m.created_at)],
  ];

  return (
    <>
      <div className="crumb no-print">
        <Link href="/staff">ሁሉም ክፍሎች</Link> › <Link href="/staff/hr/members">አባላት</Link> › {m.full_name}
      </div>
      {saved && <div className="alert ok">ተቀምጧል።</div>}
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="title" style={{ margin: 0 }}>
          {m.title ? `${TITLES[m.title as keyof typeof TITLES]} ` : ''}{m.full_name}
          {!m.is_active && <span className="pill absent" style={{ marginInlineStart: 8 }}>ተሰርዟል</span>}
        </h1>
        <div className="btn-row no-print">
          <Link className="btn sm" href={`/staff/members/${id}/edit`}>አርም</Link>
          <PrintButton />
        </div>
      </div>

      <h2 className="section">የምዝገባ መረጃ</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><th style={{ width: 200 }}>{k}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section">ክትትል በክፍል</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ክፍለ ጊዜ</th><th>ክፍል</th><th>ተገኝቷል</th><th>ግማሽ</th><th>ቀሪ</th></tr>
          </thead>
          <tbody>
            {(Object.keys(SESSION_TYPES) as SessionType[]).map((t) => {
              const c = byType.get(t) ?? { present: 0, half: 0, absent: 0 };
              return (
                <tr key={t}>
                  <td>{SESSION_TYPES[t].label}</td>
                  <td>{DEPT_NAME[SESSION_TYPES[t].dept]}</td>
                  <td>{c.present}</td><td>{c.half}</td><td>{c.absent}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="section">የቀረባቸው ቀናት ({absences.length})</h2>
      {absences.length === 0 ? (
        <p className="muted">ምንም የቀረበት ቀን የለም።</p>
      ) : (
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
