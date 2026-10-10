import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, OFFERING_STATUS, classLabel, isClassLevel, semesterLabel, type OfferingStatus } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { EduPicker } from '@/components/edu-picker';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { ReasonForm } from '@/components/reason-form';
import {
  addCourse, deleteCourse, approveCourse, unlockCourse, saveCourseDetails, copyCourses,
} from '@/lib/actions/education-admin';
import { DayChecks } from '@/components/day-checks';

type O = {
  id: string; name: string; class_level: string; status: OfferingStatus; book_name: string | null; book_path: string | null;
  days: number[]; time_text: string | null;
  offering_teachers: { member_id: string; members: { full_name: string } | null }[];
};

/** ትምህርት ክፍል: courses per class, teachers, reference books, approval. */
export default async function Courses({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; c?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">መጀመሪያ “የትምህርት ዘመን” ትር ላይ ዓመቱን ይክፈቱ።</p>;
  const cls = sp.c && isClassLevel(sp.c) ? sp.c : undefined;

  let q = supabase.from('course_offerings')
    .select('id, name, class_level, status, book_name, book_path, days, time_text, offering_teachers(member_id, members(full_name))')
    .eq('semester_id', semester.id).order('class_level').order('name');
  if (cls) q = q.eq('class_level', cls);
  const [{ data }, { data: members }] = await Promise.all([
    q, supabase.from('members').select('id, full_name, reg_no').eq('is_active', true).order('full_name'),
  ]);
  const rows = (data ?? []) as unknown as O[];
  const order = (c: string) => CLASS_LEVELS.indexOf(c as (typeof CLASS_LEVELS)[number]);
  rows.sort((a, b) => order(a.class_level) - order(b.class_level) || a.name.localeCompare(b.name));
  const pending = rows.filter((r) => r.status === 'submitted').length;
  // The semester just before this one (1ኛ → last year's 2ኛ, 2ኛ → this year's 1ኛ).
  const ordered = semesters.map((x) => ({ ...x, ec: years.find((yy) => yy.id === x.year_id)?.ec_year ?? 0 }))
    .sort((a, b) => a.ec - b.ec || a.no - b.no);
  const at = ordered.findIndex((x) => x.id === semester.id);
  const prevSem = at > 0 ? ordered[at - 1] : null;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ኮርሶችና መምህራን — {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</h2>
      <EduPicker action="/staff/education/courses" years={years} semesters={semesters} semesterId={semester.id} classLevel={cls} />
      {pending > 0 && <p className="alert ok">ለማጽደቅ የቀረቡ ኮርሶች፦ {pending}</p>}
      {prevSem && (
        <div className="btn-row no-print" style={{ margin: '8px 0' }}>
          <ActionButton action={copyCourses.bind(null, prevSem.id, semester.id)} label={`ከ${prevSem.ec} ዓ.ም ${semesterLabel(prevSem.no)} ኮርሶችን ቅዳ`} className="btn sm secondary"
            confirmText="ኮርሶቹ ከመምህራን፣ ቀንና ሰዓት እና መጽሐፍ ጋር ይቀዳሉ (ያሉት አይደገሙም)። ይቀጥል?" />
          <span className="small muted">ሁሉንም ኮርሶች እንደገና ከመጻፍ ይልቅ ከቀደመው ሴሚስተር ቅዳ፤ ከዚያ የተለወጠውን ብቻ አስተካክል።</span>
        </div>
      )}

      <MediaForm action={addCourse} submitLabel="+ ኮርስ ጨምር">
        <input type="hidden" name="semester_id" value={semester.id} />
        <div className="form-grid">
          <div className="field">
            <label>ክፍል</label>
            <select name="class_level" required defaultValue={cls ?? ''}>
              <option value="" disabled>ይምረጡ</option>
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
            </select>
          </div>
          <div className="field"><label>የኮርሱ ስም</label><input name="name" required placeholder="ለምሳሌ፦ ዶግማ" /></div>
        </div>
      </MediaForm>

      {rows.map((o) => (
        <section key={o.id} className="card" style={{ marginBottom: 12 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <div><b>{o.name}</b> · {classLabel(o.class_level)} <span className={`pill ${o.status === 'approved' ? 'present' : 'half'}`}>{OFFERING_STATUS[o.status]}</span></div>
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
            </div>
          </MediaForm>
        </section>
      ))}
      {rows.length === 0 && <p className="muted">ለዚህ ሴሚስተር ኮርስ አልተጨመረም።</p>}
    </>
  );
}
