import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { classLabel, isClassLevel, semesterLabel, type ResultRow } from '@/lib/education';
import { formatEc } from '@/lib/ethiopian-calendar';
import { loadTerms } from '@/lib/edu-data';
import { EduPicker } from '@/components/edu-picker';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { grantExemption, grantMakeup, revokeMakeup } from '@/lib/actions/education-admin';

type Grant = { offering_id: string; member_id: string; reason: string; granted_at: string; used_at?: string | null };

/** ትምህርት ክፍል: who may sit the final despite low attendance, and who gets a make-up exam. */
export default async function Exams({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; c?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const cls = sp.c && isClassLevel(sp.c) ? sp.c : '1';
  const { data } = await supabase.rpc('semester_results', { p_semester: semester.id, p_class: cls });
  const rows = (data ?? []) as ResultRow[];
  const offeringIds = [...new Set(rows.map((r) => r.offering_id))];
  const [{ data: ex }, { data: mu }] = offeringIds.length
    ? await Promise.all([
        supabase.from('final_exemptions').select('offering_id, member_id, reason, granted_at').in('offering_id', offeringIds),
        supabase.from('makeup_grants').select('offering_id, member_id, reason, granted_at, used_at').in('offering_id', offeringIds),
      ])
    : [{ data: [] }, { data: [] }];
  const exemptions = (ex ?? []) as Grant[];
  const makeups = (mu ?? []) as Grant[];
  const find = (list: Grant[], r: ResultRow) => list.find((g) => g.offering_id === r.offering_id && g.member_id === r.member_id);
  const pct = (r: ResultRow) => (r.sessions ? Math.round((r.attended / r.sessions) * 100) : null);
  const courses = [...new Map(rows.map((r) => [r.offering_id, r.course])).entries()];

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የፈተና ፈቃድና ድጋሚ ፈተና</h2>
      <p className="muted small">
        ክትትላቸው ከ{semester.min_attendance}% በታች የሆኑ ተማሪዎች ያለ ፈቃድ ዋና ፈተና አይመዘገብላቸውም። በቂ ምክንያት ካለ እዚህ ፈቃድ ይስጡ።
        ዋና ፈተና ያመለጣቸው ተማሪዎች ደግሞ ድጋሚ ፈተና ሊፈቀድላቸው ይችላል — ውጤቱ ከጸደቀ በኋላም መምህሩ አንድ ጊዜ ማስገባት ይችላል።
      </p>
      <EduPicker action="/staff/education/exams" years={years} semesters={semesters} semesterId={semester.id} classLevel={cls} />
      <p className="small"><b>{classLabel(cls)}</b> · {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</p>
      {courses.map(([oid, name]) => {
        const list = rows.filter((r) => r.offering_id === oid);
        return (
          <section key={oid} className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>{name}</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ተማሪ</th><th className="num">ክትትል</th><th>ዋና ፈተና</th><th>ፈቃድ</th><th>ድጋሚ ፈተና</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const p = pct(r);
                    const low = semester.min_attendance > 0 && p !== null && p < semester.min_attendance;
                    const e = find(exemptions, r);
                    const m = find(makeups, r);
                    return (
                      <tr key={r.member_id}>
                        <td>{r.full_name}<div className="small muted">{r.reg_no}</div></td>
                        <td className={`num ${low ? 'neg' : ''}`}>{p === null ? '—' : `${p}%`}</td>
                        <td>{r.final ?? <span className="muted">አልገባም</span>}</td>
                        <td>
                          {!low ? <span className="small muted">አያስፈልግም</span>
                            : e ? <span className="small" style={{ color: 'var(--green)' }}>✓ {e.reason}</span>
                            : (
                              <MediaForm action={grantExemption} submitLabel="ፍቀድ" card={false}>
                                <input type="hidden" name="offering_id" value={r.offering_id} />
                                <input type="hidden" name="member_id" value={r.member_id} />
                                <input name="reason" placeholder="ምክንያት" required />
                              </MediaForm>
                            )}
                        </td>
                        <td>
                          {m ? (
                            <div className="small">
                              {m.used_at ? `✓ ተፈትኗል (${formatEc(m.used_at)})` : `በመጠባበቅ ላይ — ${m.reason}`}
                              {!m.used_at && <ActionButton action={revokeMakeup.bind(null, r.offering_id, r.member_id)} label="ሰርዝ" className="btn sm secondary" />}
                            </div>
                          ) : (
                            <details>
                              <summary className="link small">ድጋሚ ፈተና ፍቀድ</summary>
                              <MediaForm action={grantMakeup} submitLabel="ፍቀድ" card={false}>
                                <input type="hidden" name="offering_id" value={r.offering_id} />
                                <input type="hidden" name="member_id" value={r.member_id} />
                                <input name="reason" placeholder="ምክንያት (ለምሳሌ፦ በሕመም)" required />
                              </MediaForm>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {courses.length === 0 && <p className="muted">በዚህ ክፍል ኮርስ ወይም ተማሪ የለም።</p>}
    </>
  );
}
