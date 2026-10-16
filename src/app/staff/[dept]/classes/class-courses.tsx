import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, OFFERING_STATUS, classLabel, isClassLevel, semesterLabel, type OfferingStatus } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { MediaForm } from '@/components/media-form';
import { Modal } from '@/components/modal';
import { AutoSubmit } from '@/components/auto-submit';
import { formatEc } from '@/lib/ethiopian-calendar';
import { ActionButton } from '@/components/action-button';
import { addCourse, copyCourses, deleteCourse, saveCourseBook } from '@/lib/actions/education-admin';

type O = {
  id: string; name: string; class_level: string; status: OfferingStatus; book_name: string | null; book_path: string | null; created_at: string;
  offering_teachers: { members: { full_name: string } | null }[];
};

/** ክፍላት → ኮርሶች: create a class's courses (with the PDF book) for a semester; teachers are given in “መምህራን”. */
export async function ClassCourses({ sp, seg }: { sp: { s?: string; c?: string }; seg: React.ReactNode }) {
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">መጀመሪያ “የትምህርት ዘመን” ትር ላይ ዓመቱን ይክፈቱ።</p>;
  const { data } = await supabase.from('course_offerings')
    .select('id, name, class_level, status, book_name, book_path, created_at, offering_teachers(members(full_name))')
    .eq('semester_id', semester.id).order('created_at', { ascending: false });
  const all = (data ?? []) as unknown as O[];
  const cls = sp.c && isClassLevel(sp.c) ? sp.c : null;   // null = every class
  const order = (c: string) => CLASS_LEVELS.indexOf(c as (typeof CLASS_LEVELS)[number]);
  const rows = (cls ? all.filter((o) => o.class_level === cls) : all)
    .sort((a, b) => order(a.class_level) - order(b.class_level) || a.name.localeCompare(b.name));
  const paths = rows.map((o) => o.book_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await supabase.storage.from('edu-books').createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));

  const ordered = semesters.map((x) => ({ ...x, ec: years.find((y) => y.id === x.year_id)?.ec_year ?? 0 }))
    .sort((a, b) => a.ec - b.ec || a.no - b.no);
  const at = ordered.findIndex((x) => x.id === semester.id);
  const prevSem = at > 0 ? ordered[at - 1] : null;
  const href = (c: string | null) => `/staff/education/classes?v=courses&s=${semester.id}${c ? `&c=${c}` : ''}`;

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ክፍላት</h2>
        {seg}
        <span className="spacer" />
        <span className="small muted">{year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</span>
        <Modal label="+ ኮርስ ፍጠር" title="አዲስ ኮርስ" sub={`${year.ec_year} ዓ.ም · ${semesterLabel(semester.no)}`}>
          <MediaForm action={addCourse} submitLabel="+ ኮርስ ፍጠር" card={false} fileField="book" folder="books" bucket="edu-books">
            <input type="hidden" name="semester_id" value={semester.id} />
            <div className="field"><label htmlFor="cc-name">የኮርሱ ስም</label><input id="cc-name" name="name" required minLength={2} placeholder="ለምሳሌ፦ ዶግማ" /></div>
            <div className="field">
              <label htmlFor="cc-cls">የሚመደብበት ክፍል</label>
              <select id="cc-cls" name="class_level" required defaultValue={cls ?? ''}>
                <option value="" disabled>ክፍል ይምረጡ</option>
                {CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cc-book">መጽሐፍ / ማጣቀሻ (PDF፣ አማራጭ)</label>
              <input id="cc-book" name="book" type="file" accept=".pdf,.doc,.docx,application/pdf" />
            </div>
          </MediaForm>
        </Modal>
        {prevSem && (
          <ActionButton action={copyCourses.bind(null, prevSem.id, semester.id)} label={`⧉ ከ${prevSem.ec} ${semesterLabel(prevSem.no)} ቅዳ`} className="btn sm secondary"
            confirmText={`የ${prevSem.ec} ዓ.ም ${semesterLabel(prevSem.no)} ኮርሶች ከመምህራን፣ ቀንና ሰዓት እና መጽሐፍ ጋር ይቀዳሉ (ያሉት አይደገሙም)። ይቀጥል?`} />
        )}
      </div>
      <div className="split">
        <aside className="rail no-print" aria-label="ሴሚስተርና ክፍል">
          <form className="rail-select" action="/staff/education/classes">
            <input type="hidden" name="v" value="courses" />
            {cls && <input type="hidden" name="c" value={cls} />}
            <label className="rail-title" htmlFor="cc-sem">ሴሚስተር</label>
            <select id="cc-sem" name="s" defaultValue={semester.id}>
              {[...ordered].reverse().map((x) => <option key={x.id} value={x.id}>{x.ec} ዓ.ም · {semesterLabel(x.no)}{x.is_active ? ' (ክፍት)' : ''}</option>)}
            </select>
            <AutoSubmit />
          </form>
          <div className="rail-title">ክፍል</div>
          <Link href={href(null)} className={!cls ? 'on' : ''}><span>ሁሉም ኮርሶች</span><b>{all.length}</b></Link>
          {CLASS_LEVELS.map((c) => {
            const n = all.filter((o) => o.class_level === c).length;
            return <Link key={c} href={href(c)} className={cls === c ? 'on' : ''}><span>{classLabel(c)}</span><b>{n}</b></Link>;
          })}
        </aside>
        <div className="split-main">
          <div className="split-head"><b>{cls ? `${classLabel(cls)} — ኮርሶች` : 'ሁሉም ኮርሶች'}</b><span className="count-badge">{rows.length}</span></div>


          <div className="table-wrap">
            <table>
              <thead><tr><th>ኮርስ</th><th>የተመደበበት ክፍል</th><th>የተፈጠረበት</th><th>መጽሐፍ</th><th>መምህር</th><th>ሁኔታ</th><th className="no-print" /></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.name}</b></td>
                    <td><Link className="pill" href={href(o.class_level)}>{classLabel(o.class_level)}</Link></td>
                    <td className="small">{formatEc(o.created_at.slice(0, 10))}</td>
                    <td>
                      {o.book_path && urlOf.get(o.book_path)
                        ? <a className="link" href={urlOf.get(o.book_path)!} target="_blank" rel="noreferrer">📄 {o.book_name ?? 'መጽሐፍ'}</a>
                        : <span className="small muted">አልተጫነም</span>}
                      <details className="inline-fold no-print">
                        <summary className="small link">{o.book_path ? 'ቀይር' : '+ ጫን'}</summary>
                        <MediaForm action={saveCourseBook} submitLabel="ጫን" card={false} fileField="book" folder="books" bucket="edu-books">
                          <input type="hidden" name="id" value={o.id} />
                          <input name="book" type="file" required accept=".pdf,.doc,.docx,application/pdf" aria-label="መጽሐፍ" />
                        </MediaForm>
                      </details>
                    </td>
                    <td className="small">{o.offering_teachers.length
                      ? o.offering_teachers.map((t) => t.members?.full_name).join('፣ ')
                      : <Link className="pill absent" href={`/staff/education/courses?s=${semester.id}&o=${o.id}`}>መምህር ይመድቡ →</Link>}</td>
                    <td><span className={`pill ${o.status === 'approved' ? 'present' : 'half'}`}>{OFFERING_STATUS[o.status]}</span></td>
                    <td className="no-print">
                      {o.status === 'draft' && <ActionButton action={deleteCourse.bind(null, o.id)} label="አጥፋ" className="btn sm danger" confirmText={`“${o.name}” ይጥፋ?`} />}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="muted">{cls ? `ለ${classLabel(cls)}` : ''} በዚህ ሴሚስተር ኮርስ የለም — “+ ኮርስ ፍጠር” ይጫኑ።</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
