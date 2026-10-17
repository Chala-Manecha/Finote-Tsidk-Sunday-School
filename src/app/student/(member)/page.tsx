import { fmtTimeRange } from '@/lib/ethiopian-calendar';
import { createClient } from '@/lib/supabase/server';
import { fmtTime } from '@/lib/ethiopian-calendar';
import { requireMember } from '@/lib/member-auth';
import {
  CLASS_LEVELS, RESULT_PARTS, DECISION, READY_MESSAGE, THANKSGIVING, classLabel, gradeOf, semesterLabel,
  type AcademicYear, type ResultRow, type Semester, type YearRow,
} from '@/lib/education';
import { ActionButton } from '@/components/action-button';
import { enrollSelf } from '@/lib/actions/student-auth';
import { ownPhoto } from '@/lib/member-photo';
import Link from 'next/link';
import { EXAM_COMPONENTS, examWindow, fmtAddis, type MyExam } from '@/lib/exams';
import { DEPT_NAME, EVENT_KINDS, type Delivery } from '@/lib/constants';
import { DeliveryBadge } from '@/components/delivery-badge';
import { fixedSchedules } from '@/lib/schedules';
import { dayNames } from '@/components/day-checks';
import { ecToIso, formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { PART_AREAS, bandOf, loadBands, memberParticipation, overall, type PartArea } from '@/lib/participation';
import { ParticipationView } from '@/components/participation-view';
import { DutyPill, type DutyStatus } from '@/components/duty-table';
import { Modal } from '@/components/modal';
import { ChooseDutyForm } from '@/components/choose-duty-form';
import { acceptDuty } from '@/lib/actions/duty';

type Duty = { id: string; dept: string | null; duty: string; duty_date: string; occasion: string; status: DutyStatus; source: 'given' | 'chosen'; accepted_at: string | null };
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type Absence = { on_date: string; area: PartArea; label: string; status: 'absent' | 'half' };


export default async function StudentHome({ searchParams }: { searchParams: Promise<{ sem?: string }> }) {
  const sp = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  const ecYear = isoToEc(todayIsoAddis()).year;
  const yearFrom = ecToIso({ year: ecYear, month: 1, day: 1 });
  const [{ data: prof }, part, bands, { data: dutyData }, { data: absData }, photo] = await Promise.all([
    supabase.rpc('my_member_profile'),
    memberParticipation(supabase, me.memberId, yearFrom),
    loadBands(supabase),
    supabase.rpc('my_duties'),
    supabase.rpc('member_absences', { p_member: me.memberId, p_limit: 8 }),
    ownPhoto(me.photoPath),
  ]);
  const p = ((prof ?? []) as { sex: 'male' | 'female' | null; joined_year: number | null }[])[0];
  const female = p?.sex === 'female';
  const first = me.fullName.replace(/^(ቀሲስ|ዲያቆን|ዶክተር|መምህር|መምህርት) /, '').split(' ')[0];
  const duties = (dutyData ?? []) as Duty[];
  const today = todayIsoAddis();
  const toAccept = duties.filter((d) => d.source === 'given' && !d.accepted_at && d.duty_date >= today).reverse();
  const taken = duties.filter((d) => d.accepted_at);
  const upcoming = taken.filter((d) => d.duty_date >= today).reverse();
  const pastDuties = taken.filter((d) => d.duty_date < today);
  const absences = (absData ?? []) as Absence[];
  const all = overall(part);
  const allBand = bandOf(all, bands);
  const { data: yearData } = await supabase.from('academic_years').select('id, ec_year, is_active').eq('is_active', true).maybeSingle();
  const year = yearData as AcademicYear | null;

  const [{ data: semData }, { data: enr }] = await Promise.all([
    year ? supabase.from('semesters').select('*').eq('year_id', year.id).order('no') : Promise.resolve({ data: [] }),
    year ? supabase.from('enrollments').select('class_level').eq('year_id', year.id).eq('member_id', me.memberId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const semesters = (semData ?? []) as Semester[];
  const classLevel = (enr as { class_level: string | null } | null)?.class_level ?? null;
  // አሳይመንቶች of my class this year (no approval needed) and my scores
  const [{ data: asgData }, { data: scoreData }] = classLevel && year ? await Promise.all([
    supabase.from('assignments').select('id, title, max_points, due_on, created_at, course_offerings!inner(name, class_level, semesters!inner(year_id))')
      .eq('course_offerings.class_level', classLevel).eq('course_offerings.semesters.year_id', year.id).order('created_at', { ascending: false }),
    supabase.from('assignment_scores').select('assignment_id, score').eq('member_id', me.memberId),
  ]) : [{ data: [] }, { data: [] }];
  const assignments = ((asgData ?? []) as unknown as { id: string; title: string; max_points: number; due_on: string | null; course_offerings: { name: string } }[])
    .map((x) => ({ id: x.id, title: x.title, max: Number(x.max_points), due_on: x.due_on, course: x.course_offerings.name }));
  const myScores = new Map(((scoreData ?? []) as { assignment_id: string; score: number | null }[])
    .filter((x) => x.score != null).map((x) => [x.assignment_id, Number(x.score)]));

  // This week's schedule for what the member takes part in (with the join link when online).
  const { data: myProgs } = await supabase.from('member_programs').select('program, status').eq('member_id', me.memberId);
  const takes = (p: string) => (myProgs ?? []).some((x) => x.program === p && x.status === 'active');
  const [{ data: weekEvents }, fixed, { data: abnet }, { data: myCourses }] = await Promise.all([
    supabase.from('events').select('id, title, event_date, event_time, kind, place, mode, platform, link').eq('status', 'approved')
      .gte('event_date', today).lte('event_date', addDaysIso(today, 7)).order('event_date').order('event_time'),
    takes('mezmur') ? fixedSchedules(supabase, { dept: 'mezmur', withLink: true }) : Promise.resolve([]),
    takes('abnet') ? supabase.from('abnet_sessions').select('id, subject, teacher, day_text, time_text, mode, platform, link') : Promise.resolve({ data: [] }),
    classLevel && year
      ? supabase.from('course_offerings').select('id, name, days, time_text, mode, platform, link, semesters!inner(is_active, year_id)')
          .eq('class_level', classLevel).eq('semesters.year_id', year.id).eq('semesters.is_active', true)
      : Promise.resolve({ data: [] }),
  ]);
  type Item = { key: string; title: string; when: string; d: Partial<Delivery>; place?: string | null };
  const schedule: Item[] = [
    ...(weekEvents ?? []).filter((e) => !e.kind || e.kind === 'meeting' || (e.kind === 'wereb' ? takes('mezmur') : takes(e.kind)))
      .map((e) => ({ key: e.id, title: `${e.kind ? `${EVENT_KINDS[e.kind]}፦ ` : ''}${e.title}`, when: `${formatEc(e.event_date, { weekday: true })} · ${fmtTime(e.event_time)}`, d: e as Partial<Delivery>, place: e.place })),
    ...(myCourses ?? []).map((c) => ({ key: c.id, title: `ኮርስ፦ ${c.name}`, when: [c.days?.length ? dayNames(c.days) : '', fmtTimeRange(c.time_text)].filter(Boolean).join(' · ') || 'ቋሚ', d: c as Partial<Delivery> })),
    ...(abnet ?? []).map((a) => ({ key: a.id, title: `አብነት፦ ${a.subject ?? ''}`, when: [a.day_text, a.time_text].filter(Boolean).join(' · '), d: a as Partial<Delivery> })),
    ...fixed.map((f) => ({ key: f.id, title: f.title, when: [f.day_text, f.time_text].filter(Boolean).join(' · '), d: f, place: f.place })),
  ];

  const { data: examData } = await supabase.rpc('my_exams');
  const exams = (examData ?? []) as MyExam[];
  const openExams = exams.filter((x) => !x.submitted_at && (examWindow(x) === 'open' || x.attempt_id));
  const upcomingExams = exams.filter((x) => !x.attempt_id && examWindow(x) === 'upcoming');
  const doneExams = exams.filter((x) => x.submitted_at);

  // one semester at a time (switch) — the open one first
  const semSel = semesters.find((x) => x.id === sp.sem) ?? semesters.find((x) => x.is_active) ?? semesters[0];
  const results = classLevel && semSel
    ? [{ s: semSel, rows: (((await supabase.rpc('semester_results', { p_semester: semSel.id, p_class: classLevel })).data ?? []) as ResultRow[]) }]
    : [];
  // classes the member may offer to teach: below their own (all, when not a student this year)
  const teachClasses = CLASS_LEVELS.filter((c) => !classLevel || CLASS_LEVELS.indexOf(c) < CLASS_LEVELS.indexOf(classLevel as never))
    .map((c) => ({ value: c, label: classLabel(c) }));
  // የእኔ ምደባ: jobs (given / chosen) and this week's programmes, by date
  type Line = { key: string; title: string; sub: string; right: React.ReactNode; date: string };
  const lines: Line[] = [
    ...upcoming.map((d) => ({ key: d.id, date: d.duty_date, title: `${d.duty} · ${d.occasion}`,
      sub: `${formatEc(d.duty_date, { weekday: true })} · ${d.source === 'chosen' ? 'የመረጥኩት' : d.dept ? DEPT_NAME[d.dept] : ''}`, right: <DutyPill {...d} /> })),
    ...schedule.map((x) => ({ key: x.key, date: '', title: x.title, sub: `${x.when}${x.place ? ` · 📍 ${x.place}` : ''}`, right: <DeliveryBadge d={x.d} compact /> })),
  ];

  const yearRow = classLevel && year
    ? (((await supabase.rpc('year_results', { p_year: year.id, p_class: classLevel })).data ?? []) as YearRow[])[0]
    : undefined;

  return (
    <>
      <section className="me-strip">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="me-avatar" src={photo} alt="" />
          : <span className="me-avatar empty" aria-hidden>{first.slice(0, 1)}</span>}
        <div className="me-strip-text">
          <b className="serif">{female ? 'ሰላም እህታችን' : 'ሰላም ወንድማችን'} {me.fullName}</b>
          <span className="small">{female ? 'እንኳን ደህና መጣሽ' : 'እንኳን ደህና መጣህ'} · መለያ ቁ. {me.regNo}{classLevel ? ` · ${classLabel(classLevel)}` : ''}{p?.joined_year ? ` · ከ${p.joined_year} ዓ.ም ጀምሮ` : ''}</span>
        </div>
        <div className="me-strip-stats">
          <span><b>{all !== null ? `${all}%` : '—'}</b>ተሳትፎ{allBand && <em className={`band b-${allBand.key}`}>{allBand.label}</em>}</span>
          <span><b>{duties.filter((d) => d.status === 'done').length}/{taken.length}</b>የፈጸምኳቸው</span>
          {toAccept.length > 0 && <span className="warn"><b>{toAccept.length}</b>ለመቀበል</span>}
        </div>
      </section>

      {openExams.map((x) => (
        <Link key={x.id} href={`/student/exam/${x.id}`} className="exam-open-banner">
          <span aria-hidden>📝</span>
          <span><b>{x.attempt_id ? 'ያልጨረሱት ፈተና፦' : 'አሁን ክፍት ፈተና፦'} {x.title}</b><br />
            <span className="small">{x.course} · {x.duration_min} ደቂቃ · እስከ {fmtAddis(x.closes_at)}</span></span>
          <span className="btn sm green">{x.attempt_id ? 'ቀጥል →' : 'ጀምር →'}</span>
        </Link>
      ))}

      <div className="dash-grid">
        <div className="dash-main">
          <section className="card">
            <div className="card-head">
              <b>የእኔ ትምህርት</b>
              {classLevel && <span className="pill">{classLabel(classLevel)} · {year?.ec_year} ዓ.ም</span>}
              <span style={{ flex: 1 }} />
              {classLevel && semesters.length > 1 && (
                <div className="seg">
                  {semesters.map((x) => <Link key={x.id} className={semSel?.id === x.id ? 'on' : ''} href={`/student?sem=${x.id}`}>{semesterLabel(x.no)}</Link>)}
                </div>
              )}
            </div>
            {!year && <p className="muted small">የትምህርት ዘመኑ ገና አልተከፈተም።</p>}
            {year && !enr && (
              <div className="btn-row"><span className="small">ለ{year.ec_year} ዓ.ም የትምህርት ዘመን አልተመዘገቡም።</span>
                <ActionButton action={enrollSelf} label={`ለ${year.ec_year} ዓ.ም ተመዝገብ`} className="btn sm" /></div>
            )}
            {year && enr && !classLevel && <p className="alert ok small">ለ{year.ec_year} ዓ.ም ተመዝግበዋል። ክፍልዎን ትምህርት ክፍል በቅርቡ ይመድባል።</p>}
            {yearRow?.ready && (
              <div className="alert ok">
                <b>የ{year?.ec_year} ዓ.ም የዓመት ውጤት፦</b> አማካይ <b>{yearRow.year_average}</b> · ደረጃ <b>{yearRow.rank}/{yearRow.class_size}</b> ·{' '}
                <b className={yearRow.decision === 'repeat' ? 'neg' : 'pos'}>{yearRow.decision ? DECISION[yearRow.decision] : '—'}</b>{yearRow.rank !== null && yearRow.rank <= 3 && ' 🏅'}
                <div className="serif small">{THANKSGIVING}</div>
              </div>
            )}
            {results.map(({ s, rows }) => (
              <div key={s.id}>
                {rows.length > 0 && rows[0].ready && <div className="alert ok small"><b>{READY_MESSAGE}</b> — አማካይ {rows[0].average} · ደረጃ {rows[0].rank}/{rows[0].class_size}</div>}
                {rows.length > 0 && (
                  <ul className="my-results">
                    {rows.map((r) => {
                      const g = r.status === 'approved' ? gradeOf(Number(r.total), s.pass_mark) : null;
                      return (
                        <li key={r.offering_id}>
                          <div className="mr-top">
                            <b>{r.course}</b>
                            {g ? <span className={`mr-total ${g.passed ? 'pos' : 'neg'}`}>{r.total}<small>/100</small></span> : <span className="pill half">ገና አልጸደቀም</span>}
                          </div>
                          {g && <div className="mr-parts">{RESULT_PARTS.map((c) => <span key={c.key}>{c.label} <b>{r[c.key] ?? '—'}</b></span>)}</div>}
                          <div className="mr-foot small muted">
                            {g && <span className={`pill ${g.passed ? 'present' : 'absent'}`}>{g.label}</span>}
                            <span>ክትትል {r.sessions ? `${Math.round((r.attended / r.sessions) * 100)}%` : '—'}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rows.length === 0 ? <p className="muted small">ለዚህ ሴሚስተር ኮርሶች ገና አልተዘጋጁም።</p> : (
                  <div className="table-wrap my-results-table">
                    <table>
                      <thead><tr><th>ኮርስ</th>{RESULT_PARTS.map((c) => <th key={c.key} className="num">{c.label}</th>)}<th className="num">ድምር</th><th>ደረጃ</th><th className="num">ክትትል</th></tr></thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.offering_id}>
                            <td>{r.course}</td>
                            {r.status === 'approved'
                              ? <>{RESULT_PARTS.map((c) => <td key={c.key} className="num">{r[c.key] ?? '—'}</td>)}
                                  <td className="num"><b>{r.total}</b></td><td>{gradeOf(Number(r.total), s.pass_mark).label}</td></>
                              : <td colSpan={RESULT_PARTS.length + 2} className="muted small">ውጤቱ ገና አልጸደቀም።</td>}
                            <td className="num">{r.sessions ? `${Math.round((r.attended / r.sessions) * 100)}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="small muted" style={{ margin: '6px 0 0' }}>ፈተና {s.w_quiz} · ደብተር {s.w_notebook} · ተሣትፎ {s.w_participation} · አሳይመንት {s.w_assignment ?? 0} · አጋማሽ {s.w_mid} · ዋና {s.w_final} · ማለፊያ {s.pass_mark}</p>
              </div>
            ))}
          </section>

          {assignments.length > 0 && (
            <section className="card">
              <div className="card-head"><b>📝 አሳይመንቶች</b><span className="count-badge">{assignments.length}</span></div>
              <ul className="me-list asg-list">
                {assignments.map((x) => {
                  const my = myScores.get(x.id);
                  return (
                    <li key={x.id}>
                      <span>
                        <Link className="link" href={`/student/assignment/${x.id}`}><b>{x.title}</b></Link><br />
                        <span className="small muted">{x.course}{x.due_on ? ` · ማስረከቢያ ${formatEc(x.due_on)}` : ''}</span>
                      </span>
                      <span className="asg-right">
                        {my != null ? <b className="asg-score">{my}<small>/{x.max}</small></b> : <span className="pill half">ያልታረመ</span>}
                        <Link className="btn xs secondary" href={`/student/assignment/${x.id}`}>📄 እይ</Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(upcomingExams.length > 0 || doneExams.length > 0) && (
            <section className="card">
              <div className="card-head"><b>ኦንላይን ፈተናዎች</b></div>
              <ul className="me-list">
                {upcomingExams.map((x) => (
                  <li key={x.id}>
                    <span><b>{x.title}</b> <span className="small muted">({EXAM_COMPONENTS[x.component]})</span><br /><span className="small muted">{x.course} · ይከፈታል {fmtAddis(x.opens_at, { weekday: true })}</span></span>
                    <span className="pill pending">የሚመጣ</span>
                  </li>
                ))}
                {doneExams.map((x) => (
                  <li key={x.id}>
                    <span><Link className="link" href={`/student/exam/${x.id}`}><b>{x.title}</b></Link><br /><span className="small muted">{x.course}</span></span>
                    {x.released ? <b>{Number(x.score ?? 0)}/{Number(x.total_points)}</b> : <span className="pill half">እየታረመ</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="dash-side">
          <section className="card">
            <div className="card-head">
              <b>የእኔ ምደባ</b>
              <span style={{ flex: 1 }} />
              {takes('duty') && (
                <Modal label="+ አገልግሎት ልምረጥ" title="አገልግሎት ልምረጥ" sub="መምህርነት ወይም ሌላ አገልግሎት — ከተላከ በኋላ መቀየር አይቻልም" size="sm" btnClass="btn xs green">
                  <ChooseDutyForm today={today} classes={teachClasses} />
                </Modal>
              )}
            </div>
            {toAccept.length > 0 && (
              <div className="duty-accept">
                <div className="small"><b>እንዲቀበሉ የተመደቡ</b> — ከቀኑ በፊት ይቀበሉ፤ ከተቀበሉ በኋላ መመለስ አይቻልም።</div>
                {toAccept.map((d) => (
                  <div key={d.id} className="duty-accept-row">
                    <span><b>{d.duty}</b> · {d.occasion}<br /><span className="small muted">{formatEc(d.duty_date, { weekday: true })}{d.dept ? ` · ${DEPT_NAME[d.dept]}` : ''}</span></span>
                    <ActionButton action={acceptDuty.bind(null, d.id)} label="✓ እቀበላለሁ" className="btn xs green"
                      confirmText={`“${d.duty}” (${d.occasion}) ይቀበላሉ? ከተቀበሉ በኋላ መመለስ አይቻልም።`} />
                  </div>
                ))}
              </div>
            )}
            {lines.length === 0 && toAccept.length === 0 ? <p className="muted small">በቅርቡ ምንም የለም። “+ አገልግሎት ልምረጥ” ብለው መምረጥ ይችላሉ።</p> : (
              <ul className="me-list">
                {lines.map((l) => <li key={l.key}><span><b>{l.title}</b><br /><span className="small muted">{l.sub}</span></span>{l.right}</li>)}
              </ul>
            )}
            {pastDuties.length > 0 && (
              <details className="fold-card" style={{ marginTop: 6 }}>
                <summary className="small"><b>ያለፉ ምደባዎች ({pastDuties.length})</b></summary>
                <ul className="me-list">
                  {pastDuties.slice(0, 10).map((d) => <li key={d.id}><span>{d.duty} · {d.occasion}<br /><span className="small muted">{formatEc(d.duty_date)}</span></span><DutyPill {...d} /></li>)}
                </ul>
              </details>
            )}
          </section>

          <section className="card">
            <div className="card-head"><b>የእኔ ተሳትፎ</b><span className="small muted">{ecYear} ዓ.ም</span></div>
            <ParticipationView data={part} bands={bands} compact />
            <details className="fold-card" style={{ marginTop: 8 }}>
              <summary className="small"><b>የቀረሁባቸው ቀናት ({absences.length})</b></summary>
              {absences.length === 0 ? <p className="muted small">የቀሩበት ቀን የለም። በርቱ!</p> : (
                <ul className="me-list">
                  {absences.map((a, i) => (
                    <li key={i}>
                      <span>{PART_AREAS[a.area] ?? a.area}{a.label ? ` — ${a.label}` : ''}<br /><span className="small muted">{formatEc(a.on_date, { weekday: true })}</span></span>
                      <span className="pill absent">{a.status === 'half' ? (a.area === 'teaching' ? 'አርፍዷል' : 'ግማሽ') : 'ቀሪ'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </section>
        </aside>
      </div>
    </>
  );
}
