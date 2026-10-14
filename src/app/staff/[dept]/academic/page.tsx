import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { semesterLabel, type AcademicYear, type Semester } from '@/lib/education';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { formatEc } from '@/lib/ethiopian-calendar';
import { createYear, activateYear, saveSemester, activateSemester, saveYearRules, copySemesterRules } from '@/lib/actions/education-admin';

/** ትምህርት ክፍል: academic years, the two semesters, weights and pass mark. */
export default async function Academic({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const [{ data: y }, { data: s }] = await Promise.all([
    supabase.from('academic_years').select('id, ec_year, is_active, promote_min_average, max_failed_courses').order('ec_year', { ascending: false }),
    supabase.from('semesters').select('*').order('no'),
  ]);
  const years = (y ?? []) as AcademicYear[];
  const semesters = (s ?? []) as Semester[];

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የትምህርት ዘመንና ሴሚስተር</h2>
      <p className="muted small">እያንዳንዱ ዓመት 2 ሴሚስተር አለው። የውጤት ነጥቦቹ (ድምር 100) እና ማለፊያው እዚህ ይወሰናሉ፤ መምህራንና ተማሪዎች ያዩታል።</p>
      <MediaForm action={createYear} submitLabel="+ አዲስ የትምህርት ዘመን ክፈት">
        <div className="field" style={{ maxWidth: 240 }}><label>ዓ.ም</label><input name="ec_year" type="number" min={2000} max={2100} required placeholder="2019" /></div>
      </MediaForm>

      {years.map((yr) => (
        <section key={yr.id} className="card" style={{ marginBottom: 14 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{yr.ec_year} ዓ.ም {yr.is_active && <span className="pill present">ክፍት</span>}</h3>
            {!yr.is_active && <ActionButton action={activateYear.bind(null, yr.id)} label="ክፈት" className="btn sm secondary" />}
          </div>
          <details className="sem-box rules">
            <summary>
              <span className="sem-title"><b>🎓 የመዛወሪያ ደንብ</b></span>
              <span className="sem-chips"><span>አማካይ ≥ {yr.promote_min_average}</span><span>የወደቁ ≤ {yr.max_failed_courses}</span></span>
            </summary>
            <div className="sem-body">
              <MediaForm action={saveYearRules} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                <input type="hidden" name="id" value={yr.id} />
                <div className="mini-grid two">
                  <label>ለመዛወር ዝቅተኛ የዓመት አማካይ<input name="promote_min_average" type="number" min={0} max={100} defaultValue={yr.promote_min_average} required /></label>
                  <label>የሚፈቀድ የወደቁ ኮርሶች ብዛት<input name="max_failed_courses" type="number" min={0} defaultValue={yr.max_failed_courses} required /></label>
                </div>
              </MediaForm>
            </div>
          </details>
          {semesters.filter((x) => x.year_id === yr.id).map((x) => (
            <details key={x.id} className="sem-box">
              <summary>
                <span className="sem-title"><b>{semesterLabel(x.no)}</b> {x.is_active && <span className="pill present">ክፍት</span>}</span>
                <span className="sem-chips">
                  <span>ፈተና {x.w_quiz}</span><span>ደብተር {x.w_notebook}</span><span>ተሣትፎ {x.w_participation}</span>
                  <span>አጋማሽ {x.w_mid}</span><span>ዋና {x.w_final}</span><span className="pass">ማለፊያ {x.pass_mark}</span>
                </span>
                <span className="small muted">{x.starts_on ? formatEc(x.starts_on) : 'ቀን አልተወሰነም'}{x.ends_on ? ` – ${formatEc(x.ends_on)}` : ''}</span>
              </summary>
              <div className="sem-body">
                <MediaForm action={saveSemester} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                  <input type="hidden" name="id" value={x.id} />
                  <div className="sem-groups">
                    <fieldset>
                      <legend>📊 የውጤት ነጥቦች <span className="small muted">(ድምሩ 100)</span></legend>
                      <div className="mini-grid">
                        <label>ፈተና (Quiz)<input name="w_quiz" type="number" min={0} max={100} defaultValue={x.w_quiz} required /></label>
                        <label>ደብተር ማርክ<input name="w_notebook" type="number" min={0} max={100} defaultValue={x.w_notebook} required /></label>
                        <label>ተሣትፎ<input name="w_participation" type="number" min={0} max={100} defaultValue={x.w_participation} required /></label>
                        <label>አጋማሽ ፈተና<input name="w_mid" type="number" min={0} max={100} defaultValue={x.w_mid} required /></label>
                        <label>ዋና ፈተና<input name="w_final" type="number" min={0} max={100} defaultValue={x.w_final} required /></label>
                        <label className="em">ማለፊያ (ከ100)<input name="pass_mark" type="number" min={0} max={100} defaultValue={x.pass_mark} required /></label>
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>📅 ቀናት</legend>
                      <div className="mini-grid two">
                        <div className="field"><span className="label">የሚጀምርበት</span><EcDatePicker name="starts_on" defaultIso={x.starts_on} yearsBack={1} yearsForward={1} /></div>
                        <div className="field"><span className="label">የሚያበቃበት</span><EcDatePicker name="ends_on" defaultIso={x.ends_on} yearsBack={1} yearsForward={1} /></div>
                        <div className="field"><span className="label">አጋማሽ ፈተና</span><EcDatePicker name="mid_exam_on" defaultIso={x.mid_exam_on} yearsBack={1} yearsForward={1} /></div>
                        <div className="field"><span className="label">ዋና ፈተና</span><EcDatePicker name="final_exam_on" defaultIso={x.final_exam_on} yearsBack={1} yearsForward={1} /></div>
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>🧾 ለዋና ፈተና ዝቅተኛ ክትትል</legend>
                      <div className="mini-grid two">
                        <label>መደበኛ ተማሪዎች (%)<input name="min_attendance" type="number" min={0} max={100} defaultValue={x.min_attendance} required /></label>
                        <label>የሳምንት መጨረሻ ተማሪዎች (%)<input name="min_attendance_distance" type="number" min={0} max={100} defaultValue={x.min_attendance_distance ?? 50} required /></label>
                      </div>
                      <p className="hint small">0 = ገደብ የለም። ከዚህ በታች የሆነ ተማሪ ያለ ትምህርት ክፍል ፈቃድ ዋና ፈተና አይመዘገብለትም።</p>
                    </fieldset>
                  </div>
                </MediaForm>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  {!x.is_active && <ActionButton action={activateSemester.bind(null, x.id)} label="ይህን ሴሚስተር ክፈት" className="btn sm green" />}
                  {x.no === 2 && (() => {
                    const first = semesters.find((z) => z.year_id === yr.id && z.no === 1);
                    return first ? <ActionButton action={copySemesterRules.bind(null, first.id, x.id)} label="ነጥቦቹን እንደ 1ኛ ሴሚስተር አድርግ" className="btn sm secondary"
                      confirmText="የውጤት ነጥቦች፣ ማለፊያና ዝቅተኛ ክትትል ከ1ኛ ሴሚስተር ይቀዳሉ (ቀኖቹ አይቀየሩም)። ይቀጥል?" /> : null;
                  })()}
                </div>
              </div>
            </details>
          ))}
        </section>
      ))}
      {years.length === 0 && <p className="muted">እስካሁን የትምህርት ዘመን አልተከፈተም።</p>}
    </>
  );
}
