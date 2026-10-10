import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { classLabel, semesterLabel } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { formatEc, todayIsoAddis, weekdayOf, WEEKDAYS_AM } from '@/lib/ethiopian-calendar';
import { EduPicker } from '@/components/edu-picker';
import { EcDatePicker } from '@/components/ec-date-picker';
import { MediaForm } from '@/components/media-form';
import { PrintButton } from '@/components/print-button';
import { saveTeacherAttendance } from '@/lib/actions/education-admin';

const T_STATUS = { present: 'ተገኝቷል', late: 'አርፍዷል', absent: 'ቀሪ', excused: 'በፈቃድ' } as const;
type TStatus = keyof typeof T_STATUS;
const pctCls = (p: number | null, min: number) => (p === null ? 'muted' : p < min ? 'neg' : '');

/** ትምህርት ክፍል: class attendance across all courses (taken by teachers) + attendance of the teachers. */
export default async function CourseAttendance({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ v?: string; s?: string; c?: string; d?: string; all?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const view = sp.v === 'teachers' ? 'teachers' : 'students';
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const base = `/staff/${dept}/course-attendance`;

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የኮርስ ክትትል — {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</h2>
        <PrintButton />
      </div>
      <div className="cat-tabs no-print">
        <Link href={`${base}?v=students&s=${semester.id}`} className={view === 'students' ? 'active' : ''}>የተማሪዎች ክትትል</Link>
        <Link href={`${base}?v=teachers&s=${semester.id}`} className={view === 'teachers' ? 'active' : ''}>የመምህራን ክትትል</Link>
      </div>
      {view === 'students'
        ? <Students supabase={supabase} base={base} years={years} semesters={semesters} semester={semester} cls={sp.c} />
        : <Teachers supabase={supabase} base={base} semester={semester} date={sp.d} all={sp.all === '1'} canEdit={dept === 'education'} />}
    </>
  );
}

type Sb = Awaited<ReturnType<typeof createClient>>;
type Terms = Awaited<ReturnType<typeof loadTerms>>;

async function Students({ supabase, base, years, semesters, semester, cls: c }: {
  supabase: Sb; base: string; years: Terms['years']; semesters: Terms['semesters']; semester: NonNullable<Terms['semester']>; cls?: string;
}) {
  const cls = c && /^(kids|[1-9]|1[0-2])$/.test(c) ? c : '1';
  const [{ data: offs }, { data: sum }, { data: enr }] = await Promise.all([
    supabase.from('course_offerings').select('id, name').eq('semester_id', semester.id).eq('class_level', cls).order('name'),
    supabase.rpc('class_attendance_summary', { p_semester: semester.id, p_class: cls }),
    supabase.from('enrollments').select('member_id, study_mode, members(full_name, reg_no)').eq('year_id', semester.year_id).eq('class_level', cls),
  ]);
  const courses = (offs ?? []) as { id: string; name: string }[];
  const { data: sess } = courses.length
    ? await supabase.from('class_sessions').select('offering_id, session_date').in('offering_id', courses.map((x) => x.id))
    : { data: [] };
  const held = new Map<string, { n: number; last: string | null }>();
  for (const x of sess ?? []) {
    const h = held.get(x.offering_id) ?? { n: 0, last: null };
    h.n += 1;
    if (!h.last || x.session_date > h.last) h.last = x.session_date;
    held.set(x.offering_id, h);
  }
  const cell = new Map(((sum ?? []) as { member_id: string; offering_id: string; attended: number; sessions: number }[])
    .map((r) => [`${r.member_id}|${r.offering_id}`, r]));
  const students = ((enr ?? []) as unknown as { member_id: string; study_mode: string; members: { full_name: string; reg_no: string } | null }[])
    .sort((a, b) => (a.members?.full_name ?? '').localeCompare(b.members?.full_name ?? ''));
  const today = todayIsoAddis();
  const stale = courses.filter((x) => { const h = held.get(x.id); return !h || (h.last && (Date.parse(today) - Date.parse(h.last)) / 864e5 > 14); });

  return (
    <>
      <EduPicker action={base} years={years} semesters={semesters} semesterId={semester.id} classLevel={cls} />
      {stale.length > 0 && (
        <p className="alert">
          ⚠ ክትትል ያልተያዘባቸው ወይም ከ14 ቀን በላይ ያልተያዘባቸው ኮርሶች፦ {stale.map((x) => x.name).join('፣ ')}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ተማሪ</th>
              {courses.map((x) => (
                <th key={x.id} className="num">
                  {x.name}
                  <div className="small muted">{held.get(x.id)?.n ?? 0} ቀን{held.get(x.id)?.last ? ` · መጨረሻ ${formatEc(held.get(x.id)!.last!)}` : ''}</div>
                </th>
              ))}
              <th className="num">አጠቃላይ</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const min = st.study_mode === 'distance' ? semester.min_attendance_distance : semester.min_attendance;
              let a = 0; let n = 0;
              return (
                <tr key={st.member_id}>
                  <td>{st.members?.full_name}<div className="small muted">{st.members?.reg_no}{st.study_mode === 'distance' ? ' · የርቀት' : ''}</div></td>
                  {courses.map((x) => {
                    const r = cell.get(`${st.member_id}|${x.id}`);
                    const p = r && r.sessions ? Math.round((r.attended / r.sessions) * 100) : null;
                    if (r) { a += r.attended; n += r.sessions; }
                    return <td key={x.id} className={`num ${pctCls(p, min)}`}>{p === null ? '—' : `${p}%`}<div className="small muted">{r ? `${r.attended}/${r.sessions}` : ''}</div></td>;
                  })}
                  {(() => { const p = n ? Math.round((a / n) * 100) : null; return <td className={`num ${pctCls(p, min)}`}><b>{p === null ? '—' : `${p}%`}</b></td>; })()}
                </tr>
              );
            })}
            {students.length === 0 && <tr><td colSpan={courses.length + 2} className="muted">በዚህ ክፍል ተማሪ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        ክትትሉን የሚይዙት መምህራን ናቸው (በ“የማስተምራቸው ክፍሎች” ገጽ)። ቀይ = ከዝቅተኛው በታች (መደበኛ {semester.min_attendance}% · የርቀት {semester.min_attendance_distance}%)።
        ግማሽ መገኘት እንደ መገኘት ይቆጠራል።
      </p>
    </>
  );
}

async function Teachers({ supabase, base, semester, date: d, all, canEdit }: {
  supabase: Sb; base: string; semester: NonNullable<Terms['semester']>; date?: string; all: boolean; canEdit: boolean;
}) {
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIsoAddis();
  const dow = weekdayOf(date);
  const [{ data: offs }, { data: marks }, { data: semAll }] = await Promise.all([
    supabase.from('course_offerings').select('id, name, class_level, days, time_text, offering_teachers(member_id, members(full_name))')
      .eq('semester_id', semester.id).order('class_level').order('name'),
    supabase.from('teacher_attendance').select('offering_id, member_id, status, note').eq('att_date', date),
    supabase.from('teacher_attendance').select('member_id, status, offering_id, course_offerings!inner(semester_id)').eq('course_offerings.semester_id', semester.id),
  ]);
  type O = { id: string; name: string; class_level: string; days: number[]; time_text: string | null; offering_teachers: { member_id: string; members: { full_name: string } | null }[] };
  const offerings = (offs ?? []) as unknown as O[];
  const shown = all ? offerings : offerings.filter((o) => (o.days ?? []).includes(dow));
  const mark = new Map((marks ?? []).map((m) => [`${m.offering_id}_${m.member_id}`, m]));
  const rows = shown.flatMap((o) => o.offering_teachers.map((t) => ({ o, t, key: `${o.id}_${t.member_id}` })));

  // Semester summary per teacher
  const names = new Map(offerings.flatMap((o) => o.offering_teachers.map((t) => [t.member_id, t.members?.full_name ?? ''] as const)));
  const sum = new Map<string, Record<TStatus, number>>();
  for (const r of (semAll ?? []) as { member_id: string; status: TStatus }[]) {
    const x = sum.get(r.member_id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    x[r.status] += 1;
    sum.set(r.member_id, x);
  }
  const summary = [...names.entries()].map(([id, name]) => {
    const x = sum.get(id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    const counted = x.present + x.late + x.absent;
    return { id, name, ...x, pct: counted ? Math.round(((x.present + x.late) / counted) * 100) : null };
  }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.name.localeCompare(b.name));

  return (
    <>
      <form className="toolbar no-print" action={base}>
        <input type="hidden" name="v" value="teachers" />
        <input type="hidden" name="s" value={semester.id} />
        <div className="field"><span className="label">ቀን (ዓ.ም)</span><EcDatePicker name="d" defaultIso={date} yearsBack={1} yearsForward={0} /></div>
        <label className="check"><input type="checkbox" name="all" value="1" defaultChecked={all} /> ሁሉንም ኮርሶች አሳይ</label>
        <button className="btn sm">አሳይ</button>
      </form>
      <p className="small muted">{formatEc(date, { weekday: true })} — {all ? 'ሁሉም ኮርሶች' : `በ${WEEKDAYS_AM[dow]} የሚሰጡ ኮርሶች`} ({shown.length})</p>

      {rows.length === 0 ? (
        <p className="muted">{all ? 'መምህር የተመደበለት ኮርስ የለም።' : `በ${WEEKDAYS_AM[dow]} የሚሰጥ ኮርስ የለም (የኮርሱ ቀናት በ“ኮርሶችና መምህራን” ይወሰናሉ)። “ሁሉንም ኮርሶች አሳይ”ን ይጠቀሙ።`}</p>
      ) : (
        <MediaForm action={saveTeacherAttendance} submitLabel="የመምህራን ክትትል አስቀምጥ" resetOnSuccess={false} card={false}>
          <input type="hidden" name="att_date" value={date} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>መምህር</th><th>ኮርስ</th>
                  {(Object.keys(T_STATUS) as TStatus[]).map((k) => <th key={k} className="num">{T_STATUS[k]}</th>)}
                  <th className="num">—</th><th>ማስታወሻ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ o, t, key }) => {
                  const cur = mark.get(key);
                  return (
                    <tr key={key}>
                      <td>{t.members?.full_name}<input type="hidden" name="key" value={key} /></td>
                      <td>{o.name}<div className="small muted">{classLabel(o.class_level)}{o.time_text ? ` · ${o.time_text}` : ''}</div></td>
                      {(Object.keys(T_STATUS) as TStatus[]).map((k) => (
                        <td key={k} className="num"><input type="radio" name={`s_${key}`} value={k} defaultChecked={cur?.status === k} disabled={!canEdit} aria-label={T_STATUS[k]} /></td>
                      ))}
                      <td className="num"><input type="radio" name={`s_${key}`} value="" defaultChecked={!cur} disabled={!canEdit} aria-label="አልተመዘገበም" /></td>
                      <td><input name={`n_${key}`} defaultValue={cur?.note ?? ''} disabled={!canEdit} placeholder="አማራጭ" style={{ minWidth: 120 }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MediaForm>
      )}

      <h3 className="section">የሴሚስተሩ ማጠቃለያ</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>መምህር</th>{(Object.keys(T_STATUS) as TStatus[]).map((k) => <th key={k} className="num">{T_STATUS[k]}</th>)}<th className="num">የመገኘት %</th></tr></thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num">{r.present}</td><td className="num">{r.late}</td>
                <td className={`num ${r.absent ? 'neg' : ''}`}>{r.absent}</td><td className="num">{r.excused}</td>
                <td className={`num ${r.pct !== null && r.pct < 75 ? 'neg' : ''}`}><b>{r.pct === null ? '—' : `${r.pct}%`}</b></td>
              </tr>
            ))}
            {summary.length === 0 && <tr><td colSpan={6} className="muted">መምህር የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">የመገኘት % = (ተገኝቷል + አርፍዷል) ÷ (ተገኝቷል + አርፍዷል + ቀሪ)። በፈቃድ የቀሩ አይቆጠሩም።</p>
    </>
  );
}
