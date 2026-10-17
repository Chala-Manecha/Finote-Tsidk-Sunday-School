import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { CONDUCT, OFFERING_STATUS, classLabel, semesterLabel, type ComponentKey, type OfferingStatus, type Semester } from '@/lib/education';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { MarksGrid, ClassAttendanceForm } from '@/components/teach-forms';
import { ActionButton } from '@/components/action-button';
import { submitOffering, saveConduct } from '@/lib/actions/teaching';
import { ConductSelect } from '@/components/conduct-select';
import { AssignmentsView } from './assignments-view';

type Offering = { id: string; name: string; class_level: string; status: OfferingStatus; book_path: string | null; book_name: string | null; semester_id: string };

/** A teacher's own class: reference book, attendance, marks, submit for approval. */
export default async function TeachPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string; v?: string; a?: string }> }) {
  const { id } = await params;
  const { d, v, a } = await searchParams;
  const view = v === 'att' || d ? 'att' : v === 'conduct' ? 'conduct' : v === 'asg' ? 'asg' : 'marks';
  const me = await requireMember();
  const supabase = await createClient();
  const { data: isTeacher } = await supabase.rpc('is_teacher_of', { p_offering: id });
  if (!isTeacher) notFound();
  const { data: o } = await supabase.from('course_offerings').select('id, name, class_level, status, book_path, book_name, semester_id').eq('id', id).single();
  const offering = o as Offering;
  const { data: sem } = await supabase.from('semesters').select('*').eq('id', offering.semester_id).single();
  const s = sem as Semester;

  const [{ data: enr }, { data: mk }, { data: sessions }] = await Promise.all([
    supabase.from('enrollments').select('member_id').eq('year_id', s.year_id).eq('class_level', offering.class_level),
    supabase.from('marks').select('member_id, quiz, notebook, participation, mid, final, assignment, absent, note').eq('offering_id', id),
    supabase.from('class_sessions').select('id, session_date').eq('offering_id', id).order('session_date', { ascending: false }),
  ]);
  const ids = (enr ?? []).map((e) => e.member_id as string).filter((x) => x !== me.memberId);
  const { data: names } = ids.length ? await supabase.rpc('member_names', { p_ids: ids }) : { data: [] };
  const students = ((names ?? []) as { id: string; full_name: string; reg_no: string }[]).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const marks = Object.fromEntries((mk ?? []).map((m) => [m.member_id, m]));
  const [{ data: grants }, attendanceList] = await Promise.all([
    supabase.from('makeup_grants').select('member_id, used_at').eq('offering_id', id),
    Promise.all(students.map(async (x) => {
      const [{ data: pct }, { data: barred }] = await Promise.all([
        supabase.rpc('attendance_pct', { p_offering: id, p_member: x.id }),
        supabase.rpc('final_barred', { p_offering: id, p_member: x.id }),
      ]);
      return { id: x.id, pct: pct as number | null, barred: !!barred };
    })),
  ]);
  const attendance = Object.fromEntries(attendanceList.map((a) => [a.id, a.pct]));
  const barredIds = attendanceList.filter((a) => a.barred).map((a) => a.id);
  const makeupIds = (grants ?? []).filter((g) => !g.used_at).map((g) => g.member_id as string);
  const editDate = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIsoAddis();
  const editSession = (sessions ?? []).find((x) => x.session_date === editDate);
  const [{ data: prior }, { data: counts }, { data: mine }] = await Promise.all([
    editSession ? supabase.from('class_attendance').select('member_id, status').eq('session_id', editSession.id) : Promise.resolve({ data: [] }),
    (sessions ?? []).length
      ? supabase.from('class_attendance').select('session_id, status').in('session_id', sessions!.map((x) => x.id))
      : Promise.resolve({ data: [] }),
    supabase.from('teacher_attendance').select('att_date, status, note').eq('offering_id', id).eq('member_id', me.memberId).order('att_date', { ascending: false }),
  ]);
  const initial = Object.fromEntries(((prior ?? []) as { member_id: string; status: string }[]).map((x) => [x.member_id, x.status]));
  const presentOf = (sid: string) => ((counts ?? []) as { session_id: string; status: string }[]).filter((x) => x.session_id === sid && x.status !== 'absent').length;
  const { data: cd } = view === 'conduct' && ids.length
    ? await supabase.from('semester_conduct').select('member_id, conduct').eq('semester_id', s.id).in('member_id', ids)
    : { data: [] };
  const conductOf = new Map(((cd ?? []) as { member_id: string; conduct: string | null }[]).map((x) => [x.member_id, x.conduct ?? '']));
  const T_STATUS: Record<string, string> = { present: 'ተገኝቷል', late: 'አርፍዷል', absent: 'ቀሪ', excused: 'በፈቃድ' };
  const book = offering.book_path ? (await supabase.storage.from('edu-books').createSignedUrl(offering.book_path, 3600)).data?.signedUrl : null;
  const weights: Record<ComponentKey, number> = { quiz: s.w_quiz, notebook: s.w_notebook, participation: s.w_participation, mid: s.w_mid, final: s.w_final };
  const locked = offering.status !== 'draft';
  const finalsDone = students.length > 0 && students.every((x) => marks[x.id]?.final != null || barredIds.includes(x.id) || makeupIds.includes(x.id));

  const base = `/student/teach/${id}`;
  return (
    <>
      <div className="page-bar">
        <Link className="back-pill" href="/student/teach">← የማስተምራቸው</Link>
        <h1 className="title" style={{ margin: 0, fontSize: '1.3rem' }}>{offering.name}</h1>
        <span className="small muted">{classLabel(offering.class_level)} · {semesterLabel(s.no)}</span>
        <span className={`pill ${offering.status === 'approved' ? 'present' : 'half'}`}>{OFFERING_STATUS[offering.status]}</span>
        <span className="spacer" />
        <div className="seg">
          <Link className={view === 'marks' ? 'on' : ''} href={base}>📊 ውጤት</Link>
          <Link className={view === 'att' ? 'on' : ''} href={`${base}?v=att`}>🧾 የክፍል ክትትል</Link>
          <Link className={view === 'asg' ? 'on' : ''} href={`${base}?v=asg`}>📝 አሳይመንት</Link>
          <Link className={view === 'conduct' ? 'on' : ''} href={`${base}?v=conduct`}>🙂 ጠባይ</Link>
          <Link href={`${base}/exams`}>🖊 ኦንላይን ፈተናዎች</Link>
        </div>
      </div>

      <div className="exam-layout teach-layout">
        <div className="exam-main">
          {view === 'marks' ? (
            <section className="card">
              <div className="card-head"><b>ውጤት</b><span className="count-badge">{students.length} ተማሪዎች</span></div>
              <p className="small muted" style={{ marginTop: 0 }}>ነጥቦቹ የሚገቡት ከእያንዳንዱ ክፍል ከፍተኛ ነጥብ ውስጥ ነው። ማለፊያ፦ {s.pass_mark}/100።{s.min_attendance > 0 && ` ለዋና ፈተና ዝቅተኛ ክትትል፦ መደበኛ ${s.min_attendance}% · የርቀት ተማሪዎች ${s.min_attendance_distance}%።`}</p>
              <MarksGrid offeringId={id} students={students} marks={marks} weights={weights} locked={locked}
                attendance={attendance} barred={barredIds} makeup={makeupIds} passMark={s.pass_mark} assignmentWeight={s.w_assignment ?? 0} />
              {offering.status === 'draft' && (
                <div style={{ marginTop: 12 }}>
                  {finalsDone
                    ? <ActionButton action={submitOffering.bind(null, id)} label="🔒 ለትምህርት ክፍል ላክና ቆልፍ" className="btn green"
                        confirmText="ከላኩ በኋላ ውጤቱን መቀየር አይችሉም። ይላክ?" />
                    : <p className="small muted">የሁሉም ተማሪዎች የዋና ፈተና ውጤት ሲገባ “ለማጽደቅ ላክ” ይታያል።</p>}
                </div>
              )}
              {offering.status === 'submitted' && <p className="alert ok">ለትምህርት ክፍል ተልኳል፤ ማጽደቁን በመጠባበቅ ላይ።</p>}
            </section>
          ) : view === 'asg' ? (
            <AssignmentsView offeringId={id} base={base} students={students} locked={locked} weight={s.w_assignment ?? 0} picked={a} />
          ) : view === 'conduct' ? (
            <section className="card">
              <div className="card-head"><b>ጠባይ — {classLabel(offering.class_level)} · {semesterLabel(s.no)}</b><span className="count-badge">{students.length} ተማሪዎች</span></div>
              <p className="small muted" style={{ marginTop: 0 }}>ለእያንዳንዱ ተማሪ ይምረጡ — ወዲያው ይቀመጣል። የክፍሉ መምህራን በሙሉ ያያሉ፤ የመጨረሻው ምርጫ በትራንስክሪፕቱ ላይ ይወጣል።</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>ተማሪ</th><th>ጠባይ</th></tr></thead>
                  <tbody>
                    {students.map((x, i) => (
                      <tr key={x.id}>
                        <td className="num">{i + 1}</td>
                        <td>{x.full_name} <span className="small muted">{x.reg_no}</span></td>
                        <td><ConductSelect action={saveConduct} semesterId={s.id} memberId={x.id} value={conductOf.get(x.id) ?? ''} options={Object.entries(CONDUCT)} /></td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td colSpan={3} className="muted">ተማሪ የለም።</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="small muted">{Object.entries(CONDUCT).map(([k, l]) => `${k} · ${l}`).join('  ·  ')}</p>
            </section>
          ) : (
            <section className="card">
              <div className="card-head"><b>የክፍል ክትትል</b>{editSession && <span className="pill present">የ{formatEc(editDate)} ተይዟል — ማስተካከል ይችላሉ</span>}</div>
              <ClassAttendanceForm key={editDate} offeringId={id} students={students} today={editDate} initial={initial} />
              {(sessions ?? []).length > 0 && (
                <details className="fold-card" style={{ marginTop: 12 }}>
                  <summary><b>የተያዙ ቀናት ({sessions!.length})</b></summary>
                  <div className="table-wrap" style={{ marginTop: 8 }}>
                    <table>
                      <thead><tr><th>ቀን</th><th className="num">የተገኙ</th><th /></tr></thead>
                      <tbody>
                        {sessions!.map((x) => (
                          <tr key={x.id}>
                            <td>{formatEc(x.session_date, { weekday: true })}</td>
                            <td className="num">{presentOf(x.id)}/{students.length}</td>
                            <td><Link className="link small" href={`${base}?v=att&d=${x.session_date}`} scroll={false}>አስተካክል</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </section>
          )}
        </div>

        <aside className="exam-side">
          <dl className="exam-facts-list">
            <div><dt>ክፍል</dt><dd>{classLabel(offering.class_level)}</dd></div>
            <div><dt>ሴሚስተር</dt><dd>{semesterLabel(s.no)}</dd></div>
            <div><dt>ተማሪዎች</dt><dd>{students.length}</dd></div>
            <div><dt>ክፍለ ጊዜዎች</dt><dd>{(sessions ?? []).length}</dd></div>
          </dl>
          <div className="exam-side-actions">
            {book
              ? <a className="btn secondary" href={book} target="_blank" rel="noopener noreferrer">📘 ማጣቀሻ መጽሐፍ</a>
              : <span className="small muted">📘 ማጣቀሻ መጽሐፍ ገና አልተጫነም።</span>}
            <Link className="btn secondary" href={`${base}/exams`}>🖊 ኦንላይን ፈተናዎች</Link>
          </div>
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>የእኔ ክትትል (በትምህርት ክፍል)</div>
            {(mine ?? []).length === 0 ? <p className="muted small" style={{ margin: 0 }}>እስካሁን አልተመዘገበም።</p> : (
              <ul className="me-list">
                {(mine ?? []).slice(0, 8).map((x) => (
                  <li key={x.att_date}><span className="small">{formatEc(x.att_date)}{x.note ? ` — ${x.note}` : ''}</span>
                    <span className={`pill ${x.status === 'present' ? 'present' : x.status === 'absent' ? 'absent' : 'half'}`}>{T_STATUS[x.status]}</span></li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
