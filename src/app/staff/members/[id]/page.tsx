import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ageFromIso, formatEc } from '@/lib/ethiopian-calendar';
import {
  ATTENDANCE_STATUS, DEPT_NAME, GEEZ_LEVEL, MARITAL_STATUS, MEMBER_STATUS, SESSION_TYPES, SEX, TITLES, WORK_STATUS,
  type AttendanceStatus, type SessionType,
} from '@/lib/constants';
import { PrintButton } from '@/components/print-button';
import { yearsLabel, type EducationEntry, type WorkEntry } from '@/lib/member-details';

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
  const photoUrl = await signed(m.photo_path);
  const secularUrl = await signed(m.secular_school?.evidence_path);

  type Row = [string, React.ReactNode];
  const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
  const education = (m.education ?? []) as EducationEntry[];
  const work = (m.work ?? []) as WorkEntry[];
  const groups: [string, Row[]][] = [
    ['የአባልነት መረጃ', [
      ['የምዝገባ መለያ ቁጥር', <b key="r">{m.reg_no}</b>],
      ['የአባልነት ምዝገባ ቀን', m.registered_on ? formatEc(m.registered_on) : formatEc(m.created_at)],
      ['የዶክመንት ቁጥር', dash(m.doc_no)],
      ['የተቀላቀሉበት ዓመት', m.joined_year ? `${m.joined_year} ዓ.ም` : '—'],
      ['የአባልነት ሁኔታ', MEMBER_STATUS[m.member_status as keyof typeof MEMBER_STATUS]],
      ...(m.is_active ? [] : [['ሁኔታ (መልቀቂያ)', <span key="l" className="pill absent">መልቀቂያ ወስደዋል</span>] as Row]),
      ['የመረጡት ክፍል', m.member_departments.map((d: { dept: string }) => DEPT_NAME[d.dept]).join('፣ ') || '—'],
    ]],
    ['ግላዊ መረጃ', [
      ['ማዕረግ', m.title ? TITLES[m.title as keyof typeof TITLES] : '—'],
      ['ስም · የአባት · የአያት', [m.first_name, m.father_name, m.grandfather_name].filter(Boolean).join(' · ') || m.full_name],
      ['የእናት ስም', dash(m.mother_name)],
      ['የክርስትና ስም', dash(m.christian_name)],
      ['ክርስትና የተነሱበት', dash(m.baptism_church)],
      ['የትውልድ ቀን', m.dob ? `${formatEc(m.dob)} (ዕድሜ ${ageFromIso(m.dob)})` : '—'],
      ['ፆታ', SEX[m.sex as keyof typeof SEX]],
      ['የትዳር ሁኔታ', m.marital_status ? MARITAL_STATUS[m.marital_status as keyof typeof MARITAL_STATUS] : '—'],
      ['ዜግነት', m.is_ethiopian ? 'ኢትዮጵያዊ' : m.nationality],
      ['ቋንቋ', (m.languages ?? []).join('፣ ') || '—'],
      ['የግዕዝ ችሎታ', GEEZ_LEVEL[m.geez_level as keyof typeof GEEZ_LEVEL]],
    ]],
    ['አድራሻ እና ግንኙነት', [
      ['አድራሻ', [m.region, m.city, m.sub_city, m.woreda && `ወረዳ ${m.woreda}`, m.house_no && `የቤት ቁ. ${m.house_no}`].filter(Boolean).join('፣ ') || '—'],
      ['ስልክ', [m.phone, m.phone2].filter(Boolean).join(' · ') || '—'],
      ['ኢሜይል', dash(m.email)],
      ['Telegram', m.telegram_username ? `@${m.telegram_username}` : '—'],
      ['የንሰሐ አባት', [m.confessor_name, m.confessor_phone].filter(Boolean).join(' · ') || '—'],
      ['የአደጋ ጊዜ ተጠሪ', [m.emergency_name, m.emergency_relation && `(${m.emergency_relation})`, m.emergency_phone].filter(Boolean).join(' ') || '—'],
    ]],
    ['ትምህርት እና ሥራ', [
      ['አለማዊ ትምህርት', education.length
        ? <>{education.map((e, i) => <div key={i}>{[e.level, e.field, e.institution].filter(Boolean).join(' · ')} <span className="muted small">{yearsLabel(e)}</span></div>)}
            {secularUrl && <a className="link" href={secularUrl} target="_blank">ማስረጃ</a>}</>
        : m.secular_school ? <>{m.secular_school.name} {secularUrl && <a className="link" href={secularUrl} target="_blank">ማስረጃ</a>}</> : '—'],
      ['ቀድሞ ሰ/ት/ቤት', m.prior_school
        ? <>{m.prior_school.name} · {m.prior_school.years ?? '—'} ዓመት {priorUrl && <a className="link" href={priorUrl} target="_blank">ማስረጃ</a>}</>
        : '—'],
      ['ሁኔታ', WORK_STATUS[m.work_status as keyof typeof WORK_STATUS]],
      ['ሥራ', work.length
        ? work.map((w, i) => <div key={i}>{[w.field, w.workplace].filter(Boolean).join(' · ')} <span className="muted small">{yearsLabel(w)}</span></div>)
        : '—'],
    ]],
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

      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={m.full_name} className="member-photo" />
      )}
      {groups.map(([title, rows]) => (
        <section key={title}>
          <h2 className="section">{title}</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}><th style={{ width: 200 }}>{k}</th><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

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
