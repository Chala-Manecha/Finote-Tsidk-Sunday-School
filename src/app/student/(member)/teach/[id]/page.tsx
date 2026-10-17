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
export default async function TeachPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string; v?: string; a?: string; e?: string; new?: string }> }) {
  const { id } = await params;
  const { d, v, a, e: edit, new: fresh } = await searchParams;
  const view = v === 'att' || d || fresh ? 'att' : v === 'asg' ? 'asg' : 'marks';
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
  const { data: cd } = view === 'marks' && ids.length
    ? await supabase.from('semester_conduct').select('member_id, conduct').eq('semester_id', s.id).in('member_id', ids)
    : { data: [] };
  const conductOf = new Map(((cd ?? []) as { member_id: string; conduct: string | null }[]).map((x) => [x.member_id, x.conduct ?? '']));
  const T_STATUS: Record<string, string> = { present: 'ተገኝቷል', late: 'አርፍዷል', absent: 'ቀሪ', excused: 'በፈቃድ' };
  const book = offering.book_path ? (await supabase.storage.from('edu-books').createSignedUrl(offering.book_path, 3600)).data?.signedUrl : null;
  const weights: Record<ComponentKey, number> = { quiz: s.w_quiz, notebook: s.w_notebook, participation: s.w_participation, mid: s.w_mid, final: s.w_final };
  const locked = offering.status !== 'draft';
  // every student needs every mark (0 or more) before the results go to ትምህርት ክፍል
  const PARTS: [ComponentKey, string][] = [['quiz', 'ፈተና'], ['notebook', 'ደብተር'], ['participation', 'ተሣትፎ'], ['mid', 'አጋማሽ'], ['final', 'ዋና']];
  const missingOf = (sid: string) => PARTS.filter(([k]) => weights[k] > 0 && marks[sid]?.[k] == null
    && !(k === 'final' && (barredIds.includes(sid) || makeupIds.includes(sid)))).map(([, l]) => l);
  const missing = students.map((x) => ({ x, parts: missingOf(x.id) })).filter((m) => m.parts.length > 0);
  const finalsDone = students.length > 0 && missing.length === 0;
  // የክፍል ክትትል: the list of days → one day (read only) → edit / a new day
  const attMode = fresh ? 'new' : d && editSession ? (edit ? 'edit' : 'show') : d ? 'new' : 'list';

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
          <Link href={`${base}/exams`}>🖊 ኦንላይን ፈተናዎች</Link>
        </div>
      </div>

      <div className="exam-layout teach-layout">
        <div className="exam-main">
          {view === 'marks' ? (
            <>
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
                    : (
                      <div className="alert">
                        <b>ለትምህርት ክፍል ለመላክ</b> ለእያንዳንዱ ተማሪ ሁሉም ነጥቦች (0 ወይም ከዚያ በላይ) መሞላት አለባቸው። ያልተሞሉ፦
                        <ul className="small" style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                          {missing.slice(0, 8).map((m) => <li key={m.x.id}>{m.x.full_name} — {m.parts.join('፣ ')}</li>)}
                          {missing.length > 8 && <li>… እና ሌሎች {missing.length - 8}</li>}
                        </ul>
                      </div>
                    )}
                </div>
              )}
              {offering.status === 'submitted' && <p className="alert ok">ለትምህርት ክፍል ተልኳል፤ ማጽደቁን በመጠባበቅ ላይ።</p>}
            </section>
            <section className="card">
              <div className="card-head"><b>🙂 ጠባይ — {classLabel(offering.class_level)} · {semesterLabel(s.no)}</b><span className="count-badge">{students.length} ተማሪዎች</span></div>
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
            </>
          ) : view === 'asg' ? (
            <AssignmentsView offeringId={id} base={base} students={students} locked={locked} weight={s.w_assignment ?? 0} picked={a} />
          ) : (
            <section className="card">
              {attMode === 'list' ? (
                <>
                  <div className="card-head">
                    <b>የክፍል ክትትል</b><span className="count-badge">{(sessions ?? []).length} ቀናት</span>
                    <span className="spacer" />
                    <Link className="btn sm green" href={`${base}?v=att&new=1`} scroll={false}>+ ክትትል ለመጨመር</Link>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>ቀን</th><th className="num">የተገኙ</th><th /></tr></thead>
                      <tbody>
                        {(sessions ?? []).map((x) => (
                          <tr key={x.id}>
                            <td>{formatEc(x.session_date, { weekday: true })}</td>
                            <td className="num">{presentOf(x.id)}/{students.length}</td>
                            <td><Link className="btn xs secondary" href={`${base}?v=att&d=${x.session_date}`} scroll={false}>ክፈት</Link></td>
                          </tr>
                        ))}
                        {(sessions ?? []).length === 0 && <tr><td colSpan={3} className="muted">እስካሁን ክትትል አልተያዘም — “+ ክትትል ለመጨመር” ይጫኑ።</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : attMode === 'show' ? (
                <>
                  <div className="card-head">
                    <Link className="back-pill" href={`${base}?v=att`} scroll={false}>← ቀናት</Link>
                    <b>{formatEc(editDate, { weekday: true })}</b>
                    <span className="pill present">{editSession ? presentOf(editSession.id) : 0}/{students.length} ተገኝተዋል</span>
                    <span className="spacer" />
                    <Link className="btn sm secondary" href={`${base}?v=att&d=${editDate}&e=1`} scroll={false}>✎ አስተካክል</Link>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>ተማሪ</th><th>ሁኔታ</th></tr></thead>
                      <tbody>
                        {students.map((x) => {
                          const st = initial[x.id];
                          return (
                            <tr key={x.id}>
                              <td>{x.full_name}</td>
                              <td>{st ? <span className={`pill ${st}`}>{st === 'present' ? 'ተገኝቷል' : st === 'half' ? 'ግማሽ' : 'ቀሪ'}</span> : <span className="small muted">—</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="card-head">
                    <Link className="back-pill" href={attMode === 'edit' ? `${base}?v=att&d=${editDate}` : `${base}?v=att`} scroll={false}>← ተመለስ</Link>
                    <b>{attMode === 'edit' ? `${formatEc(editDate, { weekday: true })} — ማስተካከያ` : 'አዲስ ክትትል'}</b>
                  </div>
                  <ClassAttendanceForm key={`${attMode}-${editDate}`} offeringId={id} students={students} today={editDate}
                    initial={attMode === 'edit' ? initial : {}} back={`${base}?v=att`} fixedDate={attMode === 'edit'} />
                </>
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
