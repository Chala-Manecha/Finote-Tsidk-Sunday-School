import type { Delivery } from '@/lib/constants';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, OFFERING_STATUS, classLabel, isClassLevel, semesterLabel, type OfferingStatus } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { EduPicker } from '@/components/edu-picker';
import { DeliveryFields } from '@/components/delivery-fields';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { ReasonForm } from '@/components/reason-form';
import {
  addCourse, deleteCourse, approveCourse, unlockCourse, saveCourseDetails, copyCourses,
} from '@/lib/actions/education-admin';
import { DayChecks, dayNames } from '@/components/day-checks';
import { PopForm } from '@/components/pop-form';
import { TeacherAttendance } from '@/components/course-attendance-views';

type O = {
  id: string; name: string; class_level: string; status: OfferingStatus; book_name: string | null; book_path: string | null;
  days: number[]; time_text: string | null; mode: Delivery["mode"]; platform: Delivery["platform"]; link: string | null;
  offering_teachers: { member_id: string; members: { full_name: string } | null }[];
};

/** ትምህርት ክፍል: courses per class, teachers, reference books, approval. */
export default async function Courses({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; c?: string; t?: string; v?: string; d?: string; all?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">መጀመሪያ “የትምህርት ዘመን” ትር ላይ ዓመቱን ይክፈቱ።</p>;
  const seg = (
    <div className="seg no-print">
      <Link href="/staff/education/courses">📘 ኮርሶች</Link>
      <Link className="on" href={`/staff/education/courses?v=teachers&s=${semester.id}`}>🧾 የመምህራን ክትትል</Link>
    </div>
  );
  if (sp.v === 'teachers') {
    return (
      <>
        <div className="page-bar">
          <h2 className="section" style={{ margin: 0 }}>የመምህራን ክትትል — {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</h2>
          {seg}
        </div>
        <TeacherAttendance supabase={supabase} base="/staff/education/courses" semester={semester} date={sp.d} all={sp.all === '1'} canEdit view="teachers" />
      </>
    );
  }
  const q = supabase.from('course_offerings')
    .select('id, name, class_level, status, book_name, book_path, days, time_text, mode, platform, link, offering_teachers(member_id, members(full_name))')
    .eq('semester_id', semester.id).order('class_level').order('name');
  const [{ data }, { data: members }, { data: offers }] = await Promise.all([
    q, supabase.from('members').select('id, full_name, reg_no').eq('is_active', true).order('full_name'),
    // members who offered to teach (from their dashboard)
    supabase.from('duty_assignments').select('id, duty, members(full_name, reg_no)').eq('source', 'chosen').like('duty', 'የኮርስ መምህር%'),
  ]);
  const all = (data ?? []) as unknown as O[];
  const tfAll = sp.t === 'none';
  // the class on the right: chosen in the left panel, else the first class that has courses
  const firstCls = CLASS_LEVELS.find((c) => all.some((r) => r.class_level === c));
  const cls = tfAll ? undefined : sp.c && isClassLevel(sp.c) ? sp.c : firstCls;
  const rows = cls ? all.filter((r) => r.class_level === cls) : all;
  const perClass = (c: string) => all.filter((r) => r.class_level === c);
  const offersFor = ((offers ?? []) as unknown as { id: string; duty: string; members: { full_name: string; reg_no: string } | null }[])
    .filter((x) => cls && x.duty.endsWith(classLabel(cls)));
  const order = (c: string) => CLASS_LEVELS.indexOf(c as (typeof CLASS_LEVELS)[number]);
  rows.sort((a, b) => order(a.class_level) - order(b.class_level) || a.name.localeCompare(b.name));
  const pending = all.filter((r) => r.status === 'submitted').length;
  const noTeacher = all.filter((r) => r.offering_teachers.length === 0).length;
  const shown = tfAll ? all.filter((r) => r.offering_teachers.length === 0) : rows;
  const tf = tfAll ? 'none' : 'all';
  const cl = (c: string) => `/staff/education/courses?s=${semester.id}&c=${c}`;
  // The semester just before this one (1ኛ → last year's 2ኛ, 2ኛ → this year's 1ኛ).
  const ordered = semesters.map((x) => ({ ...x, ec: years.find((yy) => yy.id === x.year_id)?.ec_year ?? 0 }))
    .sort((a, b) => a.ec - b.ec || a.no - b.no);
  const at = ordered.findIndex((x) => x.id === semester.id);
  const prevSem = at > 0 ? ordered[at - 1] : null;

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ኮርሶችና መምህራን</h2>
        <div className="seg no-print">
          <Link className="on" href="/staff/education/courses">📘 ኮርሶች</Link>
          <Link href={`/staff/education/courses?v=teachers&s=${semester.id}`}>🧾 የመምህራን ክትትል</Link>
        </div>
        <span className="spacer" />
        <PopForm label="+ ኮርስ ጨምር" action={addCourse} submitLabel="+ ኮርስ ጨምር">
          <input type="hidden" name="semester_id" value={semester.id} />
          <div className="field">
            <label>ክፍል</label>
            <select name="class_level" required defaultValue={cls ?? ''}>
              <option value="" disabled>ይምረጡ</option>
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
            </select>
          </div>
          <div className="field"><label>የኮርሱ ስም</label><input name="name" required placeholder="ለምሳሌ፦ ዶግማ" /></div>
        </PopForm>
        {prevSem && (
          <ActionButton action={copyCourses.bind(null, prevSem.id, semester.id)} label={`⧉ ከ${prevSem.ec} ${semesterLabel(prevSem.no)} ቅዳ`} className="btn sm secondary"
            confirmText={`የ${prevSem.ec} ዓ.ም ${semesterLabel(prevSem.no)} ኮርሶች ከመምህራን፣ ቀንና ሰዓት እና መጽሐፍ ጋር ይቀዳሉ (ያሉት አይደገሙም)። ይቀጥል?`} />
        )}
      </div>
      <div className="split">
        <aside className="rail no-print" aria-label="ክፍሎች">
          <div className="rail-title">ሴሚስተር</div>
          <EduPicker action="/staff/education/courses" years={years} semesters={semesters} semesterId={semester.id} withClass={false} />
          <div className="rail-title">ክፍል</div>
          {CLASS_LEVELS.map((c) => {
            const list = perClass(c);
            const missing = list.filter((r) => r.offering_teachers.length === 0).length;
            return (
              <Link key={c} href={cl(c)} className={`${cls === c ? 'on' : ''} ${missing ? 'warn' : ''}`}>
                <span>{classLabel(c)}</span><b title={missing ? `${missing} መምህር የሌላቸው` : ''}>{list.length}</b>
              </Link>
            );
          })}
          <div className="rail-title">ማጣሪያ</div>
          <Link href={`/staff/education/courses?s=${semester.id}&t=none`} className={`${tfAll ? 'on' : ''} ${noTeacher ? 'warn' : ''}`}><span>👤 መምህር የሌላቸው</span><b>{noTeacher}</b></Link>
          {pending > 0 && <span className="small muted" style={{ padding: '4px 8px' }}>ለማጽደቅ የቀረቡ፦ {pending}</span>}
        </aside>
        <div className="split-main">
          <div className="split-head">
            <b>{tfAll ? 'መምህር ያልተመደበላቸው ኮርሶች' : cls ? classLabel(cls) : ''}</b>
            <span className="small muted">{shown.length} ኮርሶች</span>
          </div>
          {offersFor.length > 0 && (
            <div className="duty-accept" style={{ marginBottom: 10 }}>
              <div className="small"><b>ይህን ክፍል ለማስተማር የፈለጉ</b> — ከታች ባለው “መምህር” ምርጫ መመደብ ይችላሉ፦ {offersFor.map((x) => x.members?.full_name).filter(Boolean).join('፣ ')}</div>
            </div>
          )}
      {shown.map((o) => (
        <details key={o.id} className="course-item" open={tf === 'none' || !!cls}>
          <summary>
            <span className="ci-name"><b>{o.name}</b> <span className="small muted">{classLabel(o.class_level)}</span></span>
            <span className="ci-teacher">
              {o.offering_teachers.length
                ? <span className="small">👤 {o.offering_teachers.map((t) => t.members?.full_name).join('፣ ')}</span>
                : <span className="pill absent">መምህር የለም</span>}
            </span>
            <span className="small muted ci-days">{o.days?.length ? dayNames(o.days) : '—'}{o.time_text ? ` · ${o.time_text}` : ''}</span>
            <span className={`pill ${o.status === 'approved' ? 'present' : 'half'}`}>{OFFERING_STATUS[o.status]}</span>
          </summary>
          <div className="ci-body">
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <div className="btn-row">
              {o.status === 'submitted' && <ActionButton action={approveCourse.bind(null, o.id)} label="✓ ውጤቱን አጽድቅ" className="btn sm green"
                confirmText={`የ${o.name} (${classLabel(o.class_level)}) ውጤት ይጽደቅ? ከጸደቀ በኋላ ተማሪዎች ያዩታል።`} />}
              {o.status !== 'draft' && <ReasonForm action={unlockCourse} id={o.id} field="reason" button={o.status === 'submitted' ? 'ለመምህሩ መልስ' : 'ክፈት (አስተካክል)'} placeholder="ምክንያት" />}
              {o.status === 'draft' && <ActionButton action={deleteCourse.bind(null, o.id)} label="አጥፋ" className="btn sm danger" confirmText="ኮርሱን ማጥፋት ይፈልጋሉ?" />}
            </div>
          </div>
          <MediaForm action={saveCourseDetails} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false} fileField="book" folder="books" bucket="edu-books">
            <input type="hidden" name="id" value={o.id} />
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div className="field">
                <span className="label">መምህር(ራን)</span>
                {o.offering_teachers.map((t) => (
                  <label key={t.member_id} className="check" style={{ margin: 0 }}>
                    {t.members?.full_name} <input type="checkbox" name="remove_teacher" value={t.member_id} /> <span className="small muted">አንሳ</span>
                  </label>
                ))}
                <select name="member_id" defaultValue="" aria-label="መምህር">
                  <option value="">{o.offering_teachers.length ? '+ ሌላ መምህር (አማራጭ)' : 'መምህር ይምረጡ'}</option>
                  {(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.reg_no}</option>)}
                </select>
              </div>
              <div className="field">
                <span className="label">የትምህርት ቀንና ሰዓት</span>
                <DayChecks name="days" selected={o.days} />
                <input name="time_text" defaultValue={o.time_text ?? ''} placeholder="ለምሳሌ፦ ጠዋት 3:00–4:30" aria-label="ሰዓት" style={{ marginTop: 6 }} />
              </div>
              <div className="field">
                <span className="label">ማጣቀሻ መጽሐፍ (ለመምህሩ ብቻ)</span>
                <div className="small">{o.book_name ?? (o.book_path ? 'ተጭኗል' : 'አልተጫነም')}</div>
                <input name="book" type="file" accept=".pdf,.doc,.docx,application/pdf" aria-label="መጽሐፍ" />
              </div>
              <DeliveryFields initial={o} idPrefix={`co-${o.id}`} />
            </div>
          </MediaForm>
          </div>
        </details>
      ))}
      {shown.length === 0 && <p className="muted card">{all.length === 0 ? 'ለዚህ ሴሚስተር ኮርስ አልተጨመረም። “+ ኮርስ ጨምር” ይጫኑ።' : 'በዚህ ክፍል ኮርስ የለም።'}</p>}
        </div>
      </div>
    </>
  );
}
