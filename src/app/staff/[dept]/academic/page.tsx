import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { semesterLabel, type AcademicYear, type Semester } from '@/lib/education';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { createYear, activateYear, saveSemester, activateSemester, saveYearRules } from '@/lib/actions/education-admin';

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
      <h2 className="section" style={{ marginTop: 0 }}>የትምህርት ዘመንና ወሰነ ትምህርት</h2>
      <p className="muted small">እያንዳንዱ ዓመት 2 ወሰነ ትምህርት አለው። የውጤት ነጥቦቹ (ድምር 100) እና ማለፊያው እዚህ ይወሰናሉ፤ መምህራንና ተማሪዎች ያዩታል።</p>
      <MediaForm action={createYear} submitLabel="+ አዲስ የትምህርት ዘመን ክፈት">
        <div className="field" style={{ maxWidth: 240 }}><label>ዓ.ም</label><input name="ec_year" type="number" min={2000} max={2100} required placeholder="2019" /></div>
      </MediaForm>

      {years.map((yr) => (
        <section key={yr.id} className="card" style={{ marginBottom: 14 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{yr.ec_year} ዓ.ም {yr.is_active && <span className="pill present">ንቁ</span>}</h3>
            {!yr.is_active && <ActionButton action={activateYear.bind(null, yr.id)} label="ንቁ አድርግ" className="btn sm secondary" />}
          </div>
          <MediaForm action={saveYearRules} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
            <input type="hidden" name="id" value={yr.id} />
            <div className="form-grid">
              <div className="field"><label>ለመዛወር ዝቅተኛ የዓመት አማካይ</label><input name="promote_min_average" type="number" min={0} max={100} defaultValue={yr.promote_min_average} required /></div>
              <div className="field"><label>የሚፈቀድ የወደቁ ኮርሶች ብዛት (በዓመቱ)</label><input name="max_failed_courses" type="number" min={0} defaultValue={yr.max_failed_courses} required /></div>
            </div>
          </MediaForm>
          {semesters.filter((x) => x.year_id === yr.id).map((x) => (
            <details key={x.id} style={{ marginTop: 10 }} open={x.is_active}>
              <summary>
                <b>{semesterLabel(x.no)}</b> {x.is_active && <span className="pill present">ንቁ</span>}{' '}
                <span className="small muted">ፈተና {x.w_quiz} · ደብተር {x.w_notebook} · ተሣትፎ {x.w_participation} · አጋማሽ {x.w_mid} · ዋና {x.w_final} · ማለፊያ {x.pass_mark}</span>
              </summary>
              <MediaForm action={saveSemester} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                <input type="hidden" name="id" value={x.id} />
                <div className="form-grid">
                  <div className="field"><label>ፈተና (Quiz)</label><input name="w_quiz" type="number" min={0} max={100} defaultValue={x.w_quiz} required /></div>
                  <div className="field"><label>ደብተር ማርክ</label><input name="w_notebook" type="number" min={0} max={100} defaultValue={x.w_notebook} required /></div>
                  <div className="field"><label>ተሣትፎ</label><input name="w_participation" type="number" min={0} max={100} defaultValue={x.w_participation} required /></div>
                  <div className="field"><label>አጋማሽ ፈተና</label><input name="w_mid" type="number" min={0} max={100} defaultValue={x.w_mid} required /></div>
                  <div className="field"><label>ዋና ፈተና</label><input name="w_final" type="number" min={0} max={100} defaultValue={x.w_final} required /></div>
                  <div className="field"><label>ማለፊያ ውጤት (ከ100)</label><input name="pass_mark" type="number" min={0} max={100} defaultValue={x.pass_mark} required /></div>
                  <div className="field"><span className="label">የሚጀምርበት</span><EcDatePicker name="starts_on" defaultIso={x.starts_on} yearsBack={1} yearsForward={1} /></div>
                  <div className="field"><span className="label">አጋማሽ ፈተና</span><EcDatePicker name="mid_exam_on" defaultIso={x.mid_exam_on} yearsBack={1} yearsForward={1} /></div>
                  <div className="field"><span className="label">ዋና ፈተና</span><EcDatePicker name="final_exam_on" defaultIso={x.final_exam_on} yearsBack={1} yearsForward={1} /></div>
                  <div className="field"><span className="label">የሚያበቃበት</span><EcDatePicker name="ends_on" defaultIso={x.ends_on} yearsBack={1} yearsForward={1} /></div>
                  <div className="field">
                    <label>ለዋና ፈተና የሚያስፈልግ ዝቅተኛ ክትትል (%)</label>
                    <input name="min_attendance" type="number" min={0} max={100} defaultValue={x.min_attendance} required />
                    <span className="hint">0 = ገደብ የለም። ከዚህ በታች የሆነ ተማሪ ያለ ፈቃድ ዋና ፈተና አይመዘገብለትም።</span>
                  </div>
                </div>
              </MediaForm>
              {!x.is_active && <ActionButton action={activateSemester.bind(null, x.id)} label="ይህን ወሰነ ትምህርት ንቁ አድርግ" className="btn sm secondary" />}
            </details>
          ))}
        </section>
      ))}
      {years.length === 0 && <p className="muted">እስካሁን የትምህርት ዘመን አልተከፈተም።</p>}
    </>
  );
}
