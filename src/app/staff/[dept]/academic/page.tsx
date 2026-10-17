import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Modal } from '@/components/modal';
import { createClient } from '@/lib/supabase/server';
import { semesterLabel, type AcademicYear, type Semester } from '@/lib/education';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { formatEc } from '@/lib/ethiopian-calendar';
import { createYear, activateYear, saveSemester, activateSemester, saveYearRules, copySemesterRules } from '@/lib/actions/education-admin';

/** ትምህርት ክፍል: academic years, the two semesters, weights and pass mark. */
export default async function Academic({ params, searchParams }: { params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; r?: string }> }) {
  const { dept } = await params;
  const sp = await searchParams;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const [{ data: y }, { data: s }] = await Promise.all([
    supabase.from('academic_years').select('id, ec_year, is_active, promote_min_average, max_failed_courses').order('ec_year', { ascending: false }),
    supabase.from('semesters').select('*').order('no'),
  ]);
  const years = (y ?? []) as AcademicYear[];
  const semesters = (s ?? []) as Semester[];

  // What is shown on the right: a semester (default: the open one) or a year's promotion rule.
  const rulesYear = years.find((yr) => yr.id === sp.r);
  const sem = rulesYear ? undefined
    : semesters.find((x) => x.id === sp.s) ?? semesters.find((x) => x.is_active) ?? semesters.find((x) => x.year_id === years[0]?.id);
  const semYear = sem ? years.find((yr) => yr.id === sem.year_id) : undefined;
  const base = '/staff/education/academic';

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የትምህርት ዘመንና ሴሚስተር</h2>
        <span className="spacer" />
        <Modal label="+ አዲስ የትምህርት ዘመን" title="አዲስ የትምህርት ዘመን ክፈት" sub="ሁለት ሴሚስተሮች አብረው ይፈጠራሉ" size="sm" btnClass="btn sm green">
          <MediaForm action={createYear} submitLabel="ክፈት" card={false}>
            <div className="field"><label>ዓ.ም</label><input name="ec_year" type="number" min={2000} max={2100} required placeholder="2019" /></div>
          </MediaForm>
        </Modal>
      </div>

      {years.length === 0 ? <p className="muted card">እስካሁን የትምህርት ዘመን አልተከፈተም። “+ አዲስ የትምህርት ዘመን” ይጫኑ።</p> : (
        <div className="split">
          <aside className="rail no-print" aria-label="ዓመታትና ሴሚስተሮች">
            {years.map((yr) => (
              <div key={yr.id} className="rail-group">
                <div className="rail-title">{yr.ec_year} ዓ.ም {yr.is_active && <span className="pill present">ክፍት</span>}</div>
                {semesters.filter((x) => x.year_id === yr.id).map((x) => (
                  <Link key={x.id} href={`${base}?s=${x.id}`} className={sem?.id === x.id ? 'on' : ''}>
                    <span>{semesterLabel(x.no)}</span>{x.is_active && <b>ክፍት</b>}
                  </Link>
                ))}
                <Link href={`${base}?r=${yr.id}`} className={rulesYear?.id === yr.id ? 'on' : ''}><span>🎓 የመዛወሪያ ደንብ</span></Link>
              </div>
            ))}
          </aside>

          <div className="split-main">
            {rulesYear && (
              <section className="card">
                <div className="card-head"><b>🎓 የ{rulesYear.ec_year} ዓ.ም የመዛወሪያ ደንብ</b>
                  <span style={{ flex: 1 }} />
                  {!rulesYear.is_active && <ActionButton action={activateYear.bind(null, rulesYear.id)} label="ይህን ዓመት ክፈት" className="btn sm secondary" />}
                </div>
                <MediaForm action={saveYearRules} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                  <input type="hidden" name="id" value={rulesYear.id} />
                  <div className="mini-grid two" style={{ maxWidth: 520 }}>
                    <label>ለመዛወር ዝቅተኛ የዓመት አማካይ<input name="promote_min_average" type="number" min={0} max={100} defaultValue={rulesYear.promote_min_average} required /></label>
                    <label>የሚፈቀድ የወደቁ ኮርሶች ብዛት<input name="max_failed_courses" type="number" min={0} defaultValue={rulesYear.max_failed_courses} required /></label>
                  </div>
                </MediaForm>
              </section>
            )}

            {sem && semYear && (
              <section className="card">
                <div className="card-head">
                  <b>{semYear.ec_year} ዓ.ም · {semesterLabel(sem.no)}</b>
                  {sem.is_active ? <span className="pill present">ክፍት</span> : <span className="pill">ዝግ</span>}
                  <span className="small muted">{sem.starts_on ? formatEc(sem.starts_on) : 'ቀን አልተወሰነም'}{sem.ends_on ? ` – ${formatEc(sem.ends_on)}` : ''}</span>
                  <span style={{ flex: 1 }} />
                  {!semYear.is_active && <ActionButton action={activateYear.bind(null, semYear.id)} label="ዓመቱን ክፈት" className="btn sm secondary" />}
                  {!sem.is_active && <ActionButton action={activateSemester.bind(null, sem.id)} label="ይህን ሴሚስተር ክፈት" className="btn sm green" />}
                  {sem.no === 2 && (() => {
                    const first = semesters.find((z) => z.year_id === semYear.id && z.no === 1);
                    return first ? <ActionButton action={copySemesterRules.bind(null, first.id, sem.id)} label="⧉ እንደ 1ኛ ሴሚስተር" className="btn sm secondary"
                      confirmText="የውጤት ነጥቦች፣ ማለፊያና ዝቅተኛ ክትትል ከ1ኛ ሴሚስተር ይቀዳሉ (ቀኖቹ አይቀየሩም)። ይቀጥል?" /> : null;
                  })()}
                </div>
                <MediaForm key={sem.id} action={saveSemester} submitLabel="ለውጦቹን አስቀምጥ" card={false} resetOnSuccess={false}>
                  <input type="hidden" name="id" value={sem.id} />
                  <div className="sem-panels">
                    <fieldset>
                      <legend>📊 የውጤት ነጥቦች <span className="small muted">(ድምሩ 100)</span></legend>
                      <div className="mini-grid">
                        <label>ፈተና (Quiz)<input name="w_quiz" type="number" min={0} max={100} defaultValue={sem.w_quiz} required /></label>
                        <label>ደብተር ማርክ<input name="w_notebook" type="number" min={0} max={100} defaultValue={sem.w_notebook} required /></label>
                        <label>ተሣትፎ<input name="w_participation" type="number" min={0} max={100} defaultValue={sem.w_participation} required /></label>
                        <label>አሳይመንት<input name="w_assignment" type="number" min={0} max={100} defaultValue={sem.w_assignment ?? 0} required /></label>
                        <label>አጋማሽ ፈተና<input name="w_mid" type="number" min={0} max={100} defaultValue={sem.w_mid} required /></label>
                        <label>ዋና ፈተና<input name="w_final" type="number" min={0} max={100} defaultValue={sem.w_final} required /></label>
                        <label className="em">ማለፊያ (ከ100)<input name="pass_mark" type="number" min={0} max={100} defaultValue={sem.pass_mark} required /></label>
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>📅 ቀናት</legend>
                      <div className="date-list">
                        <div className="field"><span className="label">የሚጀምርበት</span><EcDatePicker name="starts_on" defaultIso={sem.starts_on} yearsBack={1} yearsForward={1} /></div>
                        <div className="field"><span className="label">የሚያበቃበት</span><EcDatePicker name="ends_on" defaultIso={sem.ends_on} yearsBack={1} yearsForward={1} /></div>
                        <div className="field"><span className="label">አጋማሽ ፈተና</span><EcDatePicker name="mid_exam_on" defaultIso={sem.mid_exam_on} yearsBack={1} yearsForward={1} /></div>
                        <div className="field"><span className="label">ዋና ፈተና</span><EcDatePicker name="final_exam_on" defaultIso={sem.final_exam_on} yearsBack={1} yearsForward={1} /></div>
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>🧾 ለዋና ፈተና ዝቅተኛ ክትትል</legend>
                      <div className="mini-grid two">
                        <label>መደበኛ ተማሪዎች (%)<input name="min_attendance" type="number" min={0} max={100} defaultValue={sem.min_attendance} required /></label>
                        <label>የርቀት ተማሪዎች (%)<input name="min_attendance_distance" type="number" min={0} max={100} defaultValue={sem.min_attendance_distance ?? 50} required /></label>
                      </div>
                      <p className="hint small">0 = ገደብ የለም። ከዚህ በታች የሆነ ተማሪ ያለ ትምህርት ክፍል ፈቃድ ዋና ፈተና አይመዘገብለትም።</p>
                    </fieldset>
                  </div>
                </MediaForm>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
