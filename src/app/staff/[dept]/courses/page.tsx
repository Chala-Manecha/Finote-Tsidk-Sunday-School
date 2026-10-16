import type { Delivery } from '@/lib/constants';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, OFFERING_STATUS, classLabel, semesterLabel, type OfferingStatus } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { AutoSubmit } from '@/components/auto-submit';
import { DeliveryFields } from '@/components/delivery-fields';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { ReasonForm } from '@/components/reason-form';
import { approveCourse, unlockCourse, saveCourseDetails } from '@/lib/actions/education-admin';
import { ExamApprovals } from '@/components/exam-approvals';
import { WEEKDAYS_AM, fmtTimeRange, formatEc } from '@/lib/ethiopian-calendar';
import { WEEK_ORDER } from '@/lib/constants';
import { dayNames } from '@/components/day-checks';
import { TeacherAttendance } from '@/components/course-attendance-views';

type O = {
  id: string; name: string; class_level: string; status: OfferingStatus; book_name: string | null; book_path: string | null;
  days: number[]; time_text: string | null; mode: Delivery["mode"]; platform: Delivery["platform"]; link: string | null;
  offering_teachers: { member_id: string; assigned_at: string | null; members: { full_name: string } | null }[];
};

/** ትምህርት ክፍል → መምህራን: give each course its teacher(s), days and time; teachers' attendance; exam approvals. */
export default async function Courses({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; o?: string; t?: string; v?: string; d?: string; all?: string; st?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">መጀመሪያ “የትምህርት ዘመን” ትር ላይ ዓመቱን ይክፈቱ።</p>;
  const tab = (v: string) => `/staff/education/courses?s=${semester.id}${v ? `&v=${v}` : ''}`;
  const seg = (
    <div className="seg no-print">
      <Link className={!sp.v ? 'on' : ''} href={tab('')}>📌 ምደባ</Link>
      <Link className={sp.v === 'teachers' ? 'on' : ''} href={tab('teachers')}>🧾 የመምህራን ክትትል</Link>
      <Link className={sp.v === 'exams' ? 'on' : ''} href={tab('exams')}>🖊 ፈተናዎች</Link>
    </div>
  );
  if (sp.v === 'teachers' || sp.v === 'exams') {
    return (
      <>
        <div className="page-bar">
          <h2 className="section" style={{ margin: 0 }}>መምህራን</h2>
          {seg}
          <span className="spacer" />
          <span className="small muted">{year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</span>
        </div>
        {sp.v === 'teachers'
          ? <TeacherAttendance supabase={supabase} base="/staff/education/courses" semester={semester} date={sp.d} all={sp.all === '1'} canEdit view="teachers" />
          : <ExamApprovals st={sp.st} here={tab('exams')} />}
      </>
    );
  }
  const [{ data }, { data: members }, { data: offers }] = await Promise.all([
    supabase.from('course_offerings')
      .select('id, name, class_level, status, book_name, book_path, days, time_text, mode, platform, link, offering_teachers(member_id, assigned_at, members(full_name))')
      .eq('semester_id', semester.id).order('name'),
    supabase.from('members').select('id, full_name, reg_no').eq('is_active', true).order('full_name'),
    // members who offered to teach (from their dashboard)
    supabase.from('duty_assignments').select('id, duty, members(full_name, reg_no)').eq('source', 'chosen').like('duty', 'የኮርስ መምህር%'),
  ]);
  const order = (c: string) => CLASS_LEVELS.indexOf(c as (typeof CLASS_LEVELS)[number]);
  const all = ((data ?? []) as unknown as O[]).sort((a, b) => order(a.class_level) - order(b.class_level) || a.name.localeCompare(b.name));
  const noTeacher = all.filter((r) => r.offering_teachers.length === 0);
  const tfNone = sp.t === 'none';
  const picked = all.find((o) => o.id === sp.o) ?? null;
  const here = (extra = '') => `/staff/education/courses?s=${semester.id}${extra}`;
  const offersFor = (cls: string) => ((offers ?? []) as unknown as { id: string; duty: string; members: { full_name: string; reg_no: string } | null }[])
    .filter((x) => x.duty.endsWith(classLabel(cls)));
  const levels = CLASS_LEVELS.filter((c) => all.some((o) => o.class_level === c));
  const ordered = semesters.map((x) => ({ ...x, ec: years.find((y) => y.id === x.year_id)?.ec_year ?? 0 }))
    .sort((a, b) => b.ec - a.ec || b.no - a.no);
  // ምደባዎች: one row per course × teacher (courses without a teacher once)
  const list = (tfNone ? noTeacher : all).flatMap((o) => o.offering_teachers.length
    ? o.offering_teachers.map((t) => ({ o, t }))
    : [{ o, t: null as O['offering_teachers'][number] | null }]);

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>መምህራን</h2>
        {seg}
        <span className="spacer" />
        <span className="small muted">{year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</span>
        <Link className="btn sm secondary" href={`/staff/education/classes?v=courses&s=${semester.id}`}>📘 ኮርሶች (ክፍላት)</Link>
      </div>
      <div className="split">
        <aside className="rail no-print" aria-label="ኮርሶች">
          <form className="rail-select" action="/staff/education/courses">
            <label className="rail-title" htmlFor="t-sem">ሴሚስተር</label>
            <select id="t-sem" name="s" defaultValue={semester.id}>
              {ordered.map((x) => <option key={x.id} value={x.id}>{x.ec} ዓ.ም · {semesterLabel(x.no)}{x.is_active ? ' (ክፍት)' : ''}</option>)}
            </select>
            <AutoSubmit />
          </form>
          <Link href={here()} className={!picked && !tfNone ? 'on' : ''}><span>📋 ሁሉም ምደባዎች</span><b>{all.length}</b></Link>
          <Link href={here('&t=none')} className={`${tfNone ? 'on' : ''} ${noTeacher.length ? 'warn' : ''}`}><span>👤 መምህር የሌላቸው</span><b>{noTeacher.length}</b></Link>
          {levels.map((c) => (
            <div key={c} className="rail-group">
              <div className="rail-title">{classLabel(c)}</div>
              {all.filter((o) => o.class_level === c).map((o) => (
                <Link key={o.id} href={here(`&o=${o.id}`)} className={`${picked?.id === o.id ? 'on' : ''} ${o.offering_teachers.length ? '' : 'warn'}`}>
                  <span>{o.name}</span>{o.offering_teachers.length ? null : <b>!</b>}
                </Link>
              ))}
            </div>
          ))}
          {all.length === 0 && <span className="small muted" style={{ padding: '4px 8px' }}>ኮርስ የለም — በ“ክፍላት → ኮርሶች” ይፍጠሩ።</span>}
        </aside>
        <div className="split-main">
          {picked ? <Assign o={picked} members={members ?? []} offers={offersFor(picked.class_level)} back={here()} /> : (
            <>
              <div className="split-head"><b>{tfNone ? 'መምህር ያልተመደበላቸው ኮርሶች' : 'የመምህራን ምደባ'}</b><span className="small muted">{list.length} ረድፎች · ለመመደብ ወይም ለመቀየር ኮርሱን በግራ ይምረጡ</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>መምህር</th><th>የተመደቡበት</th><th>ኮርስ</th><th>ክፍል</th><th>ቀንና ሰዓት</th><th>ሁኔታ</th></tr></thead>
                  <tbody>
                    {list.map(({ o, t }) => (
                      <tr key={`${o.id}-${t?.member_id ?? 'none'}`}>
                        <td>{t ? <b>{t.members?.full_name}</b> : <span className="pill absent">መምህር የለም</span>}</td>
                        <td className="small">{t?.assigned_at ? formatEc(t.assigned_at.slice(0, 10)) : '—'}</td>
                        <td><Link className="link" href={here(`&o=${o.id}`)}>{o.name}</Link></td>
                        <td>{classLabel(o.class_level)}</td>
                        <td className="small">{o.days?.length ? dayNames(o.days) : '—'}{o.time_text ? ` · ${fmtTimeRange(o.time_text)}` : ''}</td>
                        <td><span className={`pill ${o.status === 'approved' ? 'present' : 'half'}`}>{OFFERING_STATUS[o.status]}</span></td>
                      </tr>
                    ))}
                    {list.length === 0 && <tr><td colSpan={6} className="muted">{all.length === 0 ? 'ለዚህ ሴሚስተር ኮርስ አልተፈጠረም — በ“ክፍላት → ኮርሶች” ይፍጠሩ።' : 'ሁሉም ኮርሶች መምህር አላቸው።'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** One course: teachers, day and time, where it is held; result approval. */
function Assign({ o, members, offers, back }: {
  o: O; members: { id: string; full_name: string; reg_no: string }[];
  offers: { id: string; members: { full_name: string } | null }[]; back: string;
}) {
  return (
    <section className="card assign-card">
      <div className="card-head">
        <b>{o.name}</b><span className="small muted">{classLabel(o.class_level)}</span>
        <span className={`pill ${o.status === 'approved' ? 'present' : 'half'}`}>{OFFERING_STATUS[o.status]}</span>
        <span className="spacer" />
        {o.status === 'submitted' && <ActionButton action={approveCourse.bind(null, o.id)} label="✓ ውጤቱን አጽድቅ" className="btn sm green"
          confirmText={`የ${o.name} (${classLabel(o.class_level)}) ውጤት ይጽደቅ? ከጸደቀ በኋላ ተማሪዎች ያዩታል።`} />}
        {o.status !== 'draft' && <ReasonForm action={unlockCourse} id={o.id} field="reason" button={o.status === 'submitted' ? 'ለመምህሩ መልስ' : 'ክፈት (አስተካክል)'} placeholder="ምክንያት" />}
        <Link className="btn sm secondary" href={back}>✕</Link>
      </div>
      {offers.length > 0 && (
        <div className="duty-accept" style={{ marginBottom: 12 }}>
          <div className="small"><b>ይህን ክፍል ለማስተማር የፈለጉ፦</b> {offers.map((x) => x.members?.full_name).filter(Boolean).join('፣ ')}</div>
        </div>
      )}
      <MediaForm key={o.id} action={saveCourseDetails} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
        <input type="hidden" name="id" value={o.id} />
        <div className="assign-grid">
          <fieldset>
            <legend>👤 መምህር(ራን)</legend>
            {o.offering_teachers.length === 0 && <p className="small muted" style={{ margin: 0 }}>እስካሁን የለም።</p>}
            {o.offering_teachers.map((t) => (
              <label key={t.member_id} className="teacher-chip">
                <span>{t.members?.full_name}<small>{t.assigned_at ? ` · ${formatEc(t.assigned_at.slice(0, 10))}` : ''}</small></span>
                <span className="small"><input type="checkbox" name="remove_teacher" value={t.member_id} /> አንሳ</span>
              </label>
            ))}
            <select name="member_id" defaultValue="" aria-label="መምህር">
              <option value="">{o.offering_teachers.length ? '+ ሌላ መምህር (አማራጭ)' : 'መምህር ይምረጡ'}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.reg_no}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend>🗓 ቀንና ሰዓት</legend>
            <label className="small" htmlFor={`d-${o.id}`}>የትምህርት ቀን</label>
            <select id={`d-${o.id}`} name="days" defaultValue={o.days?.[0] ?? ''}>
              <option value="">— ቀን ይምረጡ —</option>
              {WEEK_ORDER.map((d) => <option key={d} value={d}>{WEEKDAYS_AM[d]}</option>)}
            </select>
            <label className="small" htmlFor={`t-${o.id}`}>ሰዓት</label>
            <input id={`t-${o.id}`} name="time_text" defaultValue={o.time_text ? fmtTimeRange(o.time_text) : ''} maxLength={60} placeholder="ለምሳሌ፦ 8:00 – 9:30 ጠዋት" />
          </fieldset>
          <fieldset>
            <legend>📍 ቦታ</legend>
            <DeliveryFields initial={o} idPrefix={`co-${o.id}`} />
          </fieldset>
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>📄 መጽሐፍ፦ {o.book_name ?? (o.book_path ? 'ተጭኗል' : 'አልተጫነም')} · በ“ክፍላት → ኮርሶች” ይቀየራል</p>
      </MediaForm>
    </section>
  );
}
