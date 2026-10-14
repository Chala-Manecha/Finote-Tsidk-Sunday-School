import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResultsSwitch } from '@/components/results-switch';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, DECISION, classLabel, isClassLevel, semesterLabel, type AcademicYear, type ResultRow, type Semester, type YearRow } from '@/lib/education';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { PrintButton } from '@/components/print-button';
import { setYearDecision, openYearTranscript, promoteToNext } from '@/lib/actions/education-admin';

const MEDAL = ['🥇', '🥈', '🥉'];

/** ትምህርት ክፍል: both semesters, yearly average, rank, promotion, honours. */
export default async function YearEnd({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ y?: string; c?: string; m?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: ys } = await supabase.from('academic_years').select('id, ec_year, is_active, promote_min_average, max_failed_courses').order('ec_year', { ascending: false });
  const years = (ys ?? []) as AcademicYear[];
  const year = years.find((x) => x.id === sp.y) ?? years.find((x) => x.is_active) ?? years[0];
  if (!year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const cls = sp.c && isClassLevel(sp.c) ? sp.c : null;   // null = every class
  const base = `/staff/${dept}/year-end`;
  const [{ data: sm }, { data: enr }] = await Promise.all([
    supabase.from('semesters').select('*').eq('year_id', year.id).order('no'),
    supabase.from('enrollments').select('class_level').eq('year_id', year.id).not('class_level', 'is', null),
  ]);
  const sems = (sm ?? []) as Semester[];
  const levels = cls ? [cls] : CLASS_LEVELS.filter((c) => (enr ?? []).some((e) => e.class_level === c));

  return (
    <>
      {sems.length > 0 && <ResultsSwitch dept={dept} year={year} semesters={sems} current="year" cls={cls} />}
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የዓመት ማጠቃለያ — {cls ? classLabel(cls) : 'ሁሉም ክፍሎች'} · {year.ec_year} ዓ.ም</h2>
        <PrintButton />
      </div>
      <form className="toolbar no-print" action={base}>
        <div className="field">
          <label htmlFor="y">ዓመት</label>
          <select id="y" name="y" defaultValue={year.id}>{years.map((x) => <option key={x.id} value={x.id}>{x.ec_year} ዓ.ም</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="c">ክፍል</label>
          <select id="c" name="c" defaultValue={cls ?? ''}><option value="">ሁሉም</option>{CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}</select>
        </div>
        <button className="btn sm">አሳይ</button>
      </form>
      <p className="small muted">
        የመዛወሪያ ደንብ፦ የዓመት አማካይ ≥ {year.promote_min_average} እና የወደቁ ኮርሶች ≤ {year.max_failed_courses} (በ“የትምህርት ዘመን” ትር ይቀየራል)። ውሳኔውን ለየብቻ መቀየር ይቻላል። የተማሪውን ስም ሲጫኑ ሊታተም የሚችል የዓመት ውጤት ካርድ ይከፈታል።
      </p>
      {levels.length === 0 && <p className="muted card">በዚህ ዓመት ክፍል የተመደበለት ተማሪ የለም።</p>}
      {levels.map((c) => <ClassYear key={c} dept={dept} year={year} years={years} cls={c} single={!!cls} m={sp.m} />)}
    </>
  );
}

/** One class's year summary: averages, rank, decision, promote, transcripts, report cards. */
async function ClassYear({ dept, year, years, cls, single, m }: {
  dept: string; year: AcademicYear; years: AcademicYear[]; cls: string; single: boolean; m?: string;
}) {
  const supabase = await createClient();
  const sp = { m };
  const { data } = await supabase.rpc('year_results', { p_year: year.id, p_class: cls });
  const rows = (data ?? []) as YearRow[];
  const ready = rows[0]?.ready ?? false;
  const base = `/staff/${dept}/year-end`;
  const here = `${base}?y=${year.id}&c=${cls}`;

  // ወደ ቀጣይ አሳልፍ: the next academic year (if opened) and who is already placed there.
  const nextYear = [...years].sort((a, b) => a.ec_year - b.ec_year).find((x) => x.ec_year > year.ec_year);
  const { data: nextEnr } = nextYear && rows.length
    ? await supabase.from('enrollments').select('member_id, class_level').eq('year_id', nextYear.id).in('member_id', rows.map((r) => r.member_id))
    : { data: [] };
  const placed = new Map((nextEnr ?? []).map((e) => [e.member_id as string, e.class_level as string | null]));
  const decisionOf = (r: YearRow) => r.decision ?? r.auto_decision;
  const passedLeft = rows.filter((r) => decisionOf(r) === 'promoted' && !placed.get(r.member_id)).length;

  // የወደቁ ኮርሶች of the clicked student (both semesters of this year).
  const picked = sp.m ? rows.find((r) => r.member_id === sp.m) : undefined;
  let failed: { sem: number; course: string; total: number; pass: number }[] = [];
  if (picked) {
    const { data: sems } = await supabase.from('semesters').select('id, no, pass_mark').eq('year_id', year.id).order('no');
    const per = await Promise.all((sems ?? []).map(async (x) => {
      const { data: r } = await supabase.rpc('semester_results', { p_semester: x.id, p_class: cls });
      return ((r ?? []) as ResultRow[])
        .filter((y) => y.member_id === picked.member_id && Number(y.total) < Number(x.pass_mark))
        .map((y) => ({ sem: x.no as number, course: y.course, total: Number(y.total), pass: Number(x.pass_mark) }));
    }));
    failed = per.flat();
  }

  return (
    <>
      {!single && <h3 className="class-sheet-title">{classLabel(cls)} <span className="small muted">({rows.length} ተማሪዎች)</span></h3>}
      {rows.length > 0 && (ready
        ? <p className="alert ok">✓ የሁለቱም ሴሚስተሮች ውጤቶች ጸድቀዋል።</p>
        : <p className="small muted">የሁለቱም ሴሚስተሮች ሁሉም ኮርሶች ሲጸድቁ የዓመት ትራንስክሪፕትና የክብር ሰርተፍኬት ይከፈታሉ።</p>)}
      {dept === 'education' && ready && cls !== '12' && (
        <div className="card no-print promote-bar">
          {nextYear ? (
            <>
              <span>
                <b>ወደ ቀጣይ አሳልፍ</b> — ያለፉ ተማሪዎች ወደ <b>{classLabel(String(cls === 'kids' ? 1 : Number(cls) + 1))}</b> ({nextYear.ec_year} ዓ.ም)።
                {' '}<span className="small muted">ቀሪ፦ {passedLeft}</span>
              </span>
              {passedLeft > 0 && (
                <ActionButton action={promoteToNext.bind(null, year.id, cls, [])} label={`ያለፉትን ${passedLeft} በሙሉ አሳልፍ`} className="btn sm green"
                  confirmText={`ያለፉ ${passedLeft} ተማሪዎች በ${nextYear.ec_year} ዓ.ም ወደ ቀጣዩ ክፍል ይዛወሩ?`} />
              )}
            </>
          ) : <span className="small">ለማሳለፍ መጀመሪያ የ{year.ec_year + 1} ዓ.ም የትምህርት ዘመን በ“የትምህርት ዘመን” ትር ይክፈቱ።</span>}
        </div>
      )}
      {picked && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{picked.full_name} — የወደቁባቸው ኮርሶች</h3>
            <Link className="btn sm secondary no-print" href={here} scroll={false}>✕ ዝጋ</Link>
          </div>
          {failed.length === 0 ? <p className="muted">የወደቁበት ኮርስ የለም።</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>ሴሚስተር</th><th>ኮርስ</th><th className="num">ውጤት</th><th className="num">ማለፊያ</th></tr></thead>
                <tbody>
                  {failed.map((f, i) => (
                    <tr key={`${f.sem}-${f.course}-${i}`}><td>{semesterLabel(f.sem)}</td><td>{f.course}</td><td className="num neg">{f.total}</td><td className="num">{f.pass}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank">ደረጃ</th><th>ተማሪ</th><th className="num">1ኛ ሴሚስተር</th><th className="num">2ኛ ሴሚስተር</th>
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
                  <td><Link className="link" href={`/staff/report-card/${year.id}/${r.member_id}`} title="የዓመት ውጤት ካርድ">{r.full_name}</Link><div className="small muted">{r.reg_no}</div></td>
                  <td className="num">{r.sem1_average ?? '—'}</td>
                  <td className="num">{r.sem2_average ?? '—'}</td>
                  <td className="num"><b>{r.year_average ?? '—'}</b></td>
                  <td className={`num ${r.failed_courses ? 'neg' : ''}`}>
                    {r.failed_courses ? <Link className="link" scroll={false} href={`${here}&m=${r.member_id}`} title="የወደቁባቸውን ኮርሶች እይ">{r.failed_courses}</Link> : (r.failed_courses ?? '—')}
                  </td>
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
                          {decisionOf(r) === 'promoted' && nextYear && cls !== '12' && (placed.get(r.member_id)
                            ? <span className="pill present">→ {classLabel(placed.get(r.member_id)!)} ({nextYear.ec_year})</span>
                            : <ActionButton action={promoteToNext.bind(null, year.id, cls, [r.member_id])} label="ወደ ቀጣይ አሳልፍ" className="btn sm green" />)}
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
