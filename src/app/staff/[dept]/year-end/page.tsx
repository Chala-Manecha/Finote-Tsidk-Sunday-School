import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, DECISION, classLabel, isClassLevel, type AcademicYear, type YearRow } from '@/lib/education';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { PrintButton } from '@/components/print-button';
import { setYearDecision, openYearTranscript } from '@/lib/actions/education-admin';

const MEDAL = ['🥇', '🥈', '🥉'];

/** ትምህርት ክፍል: both semesters, yearly average, rank, promotion, honours. */
export default async function YearEnd({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ y?: string; c?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: ys } = await supabase.from('academic_years').select('id, ec_year, is_active, promote_min_average, max_failed_courses').order('ec_year', { ascending: false });
  const years = (ys ?? []) as AcademicYear[];
  const year = years.find((x) => x.id === sp.y) ?? years.find((x) => x.is_active) ?? years[0];
  if (!year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const cls = sp.c && isClassLevel(sp.c) ? sp.c : '1';
  const { data } = await supabase.rpc('year_results', { p_year: year.id, p_class: cls });
  const rows = (data ?? []) as YearRow[];
  const ready = rows[0]?.ready ?? false;
  const base = `/staff/${dept}/year-end`;

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የዓመት ማጠቃለያ — {classLabel(cls)} · {year.ec_year} ዓ.ም</h2>
        <PrintButton />
      </div>
      <form className="toolbar no-print" action={base}>
        <div className="field">
          <label htmlFor="y">ዓመት</label>
          <select id="y" name="y" defaultValue={year.id}>{years.map((x) => <option key={x.id} value={x.id}>{x.ec_year} ዓ.ም</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="c">ክፍል</label>
          <select id="c" name="c" defaultValue={cls}>{CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}</select>
        </div>
        <button className="btn sm">አሳይ</button>
      </form>
      <p className="small muted">
        የመዛወሪያ ደንብ፦ የዓመት አማካይ ≥ {year.promote_min_average} እና የወደቁ ኮርሶች ≤ {year.max_failed_courses} (በ“የትምህርት ዘመን” ትር ይቀየራል)። ውሳኔውን ለየብቻ መቀየር ይቻላል።
      </p>
      {rows.length > 0 && (ready
        ? <p className="alert ok">✓ የሁለቱም ወሰነ ትምህርቶች ውጤቶች ጸድቀዋል።</p>
        : <p className="small muted">የሁለቱም ወሰነ ትምህርቶች ሁሉም ኮርሶች ሲጸድቁ የዓመት ትራንስክሪፕትና የክብር ሰርተፍኬት ይከፈታሉ።</p>)}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank">ደረጃ</th><th>ተማሪ</th><th className="num">1ኛ ወሰነ ት.</th><th className="num">2ኛ ወሰነ ት.</th>
              <th className="num">የዓመት አማካይ</th><th className="num">የወደቁ</th><th>ውሳኔ</th>
              {dept === 'education' && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const honour = ready && r.rank !== null && r.rank <= 3;
              return (
                <tr key={r.member_id} className={honour ? 'top' : ''}>
                  <td className="rank">{honour ? MEDAL[r.rank! - 1] : ''}{r.rank ?? '—'}</td>
                  <td>{r.full_name}<div className="small muted">{r.reg_no}</div></td>
                  <td className="num">{r.sem1_average ?? '—'}</td>
                  <td className="num">{r.sem2_average ?? '—'}</td>
                  <td className="num"><b>{r.year_average ?? '—'}</b></td>
                  <td className={`num ${r.failed_courses ? 'neg' : ''}`}>{r.failed_courses ?? '—'}</td>
                  <td>
                    {dept === 'education' ? (
                      <MediaForm action={setYearDecision} submitLabel="✓" card={false} resetOnSuccess={false}>
                        <input type="hidden" name="year_id" value={year.id} />
                        <input type="hidden" name="member_id" value={r.member_id} />
                        <select name="decision" defaultValue={r.decision && r.decision !== r.auto_decision ? r.decision : 'auto'} aria-label="ውሳኔ">
                          <option value="auto">በደንቡ፦ {DECISION[r.auto_decision]}</option>
                          <option value="promoted">{DECISION.promoted}</option>
                          <option value="repeat">{DECISION.repeat}</option>
                        </select>
                        <input name="remark" defaultValue={r.remark ?? ''} placeholder="ማስታወሻ" style={{ maxWidth: 140 }} />
                      </MediaForm>
                    ) : <span className={r.decision === 'repeat' ? 'neg' : 'pos'}>{r.decision ? DECISION[r.decision] : '—'}</span>}
                  </td>
                  {dept === 'education' && (
                    <td className="no-print">
                      {ready && (
                        <div className="btn-row">
                          <ActionButton action={openYearTranscript.bind(null, year.id, r.member_id)} label="የዓመት ትራንስክሪፕት" className="btn sm" />
                          {honour && <Link className="btn sm secondary" href={`/staff/honours/${year.id}/${r.member_id}`}>🏅 የክብር ሰርተፍኬት</Link>}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">በዚህ ክፍል ተማሪ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
