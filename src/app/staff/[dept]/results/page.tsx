import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResultsSwitch } from '@/components/results-switch';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, RESULT_PARTS, CONDUCT, classLabel, gradeOf, isClassLevel, semesterLabel, type ResultRow } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { AutoSubmit } from '@/components/auto-submit';
import { ActionButton } from '@/components/action-button';
import { PrintButton } from '@/components/print-button';
import { openTranscript } from '@/lib/actions/education-admin';

/** ትምህርት ክፍል: class result sheet, rank, conduct, transcripts. */
export default async function Results({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; c?: string; m?: string; o?: string; q?: string; co?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const reqCls = sp.c && isClassLevel(sp.c) ? sp.c : null;
  const [{ data: offs }, { data: cond }] = await Promise.all([
    supabase.from('course_offerings').select('class_level').eq('semester_id', semester.id),
    supabase.from('semester_conduct').select('member_id, conduct, remark').eq('semester_id', semester.id),
  ]);
  const levels = CLASS_LEVELS.filter((c) => (offs ?? []).some((o) => o.class_level === c));
  // the class on the right (chosen in the left panel; else the first with courses)
  const cls = reqCls ?? levels[0] ?? null;
  const conduct = new Map((cond ?? []).map((c) => [c.member_id as string, c as { conduct: string | null }]));

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የተማሪ ውጤት</h2>
        <ResultsSwitch dept={dept} year={year} semesters={semesters} current={semester.id} cls={cls} />
        {years.length > 1 && (
          <form className="toolbar slim no-print" action={`/staff/${dept}/results`}>
            <select name="s" defaultValue={semester.id} aria-label="ዓመት">
              {years.map((y) => {
                const first = semesters.filter((x) => x.year_id === y.id).sort((a, b) => a.no - b.no)[0];
                return first ? <option key={y.id} value={y.id === year.id ? semester.id : first.id}>{y.ec_year} ዓ.ም</option> : null;
              })}
            </select>
            <AutoSubmit />
          </form>
        )}
        <span className="spacer" />
        <span className="small muted">{cls ? classLabel(cls) : ''} · {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</span>
        <PrintButton />
      </div>
      {levels.length === 0 ? <p className="muted card">ለዚህ ሴሚስተር ኮርስ ገና አልተመዘገበም።</p> : (
        <div className="split">
          <aside className="rail no-print" aria-label="ክፍሎች">
            <div className="rail-title">ክፍል</div>
            {levels.map((c) => (
              <Link key={c} href={`/staff/${dept}/results?s=${semester.id}&c=${c}`} className={cls === c ? 'on' : ''}><span>{classLabel(c)}</span></Link>
            ))}
          </aside>
          <div className="split-main">
            {cls && <ClassSheet dept={dept} semester={semester} cls={cls} sp={sp} conduct={conduct} />}
          </div>
        </div>
      )}
      <p className="small muted">ማለፊያ፦ {semester.pass_mark}/100 · ቀይ = አላለፈም · አማካይ = የኮርሶቹ ውጤት አማካይ · ደረጃ በክፍሉ ውስጥ በአማካይ ነው · የተማሪውን ስም ሲጫኑ የሁሉም ኮርሶች ውጤት ይታያል።</p>
    </>
  );
}

type Sem = NonNullable<Awaited<ReturnType<typeof loadTerms>>['semester']>;

/** One class's result sheet (courses as columns, rank, conduct from the teachers, transcript). */
async function ClassSheet({ dept, semester, cls, sp, conduct }: {
  dept: string; semester: Sem; cls: string;
  sp: { m?: string; o?: string; q?: string; co?: string }; conduct: Map<string, { conduct: string | null }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('semester_results', { p_semester: semester.id, p_class: cls });
  const rows = (data ?? []) as ResultRow[];
  const allCourses = [...new Map(rows.map((r) => [r.offering_id, r])).values()];
  const course = allCourses.find((c) => c.offering_id === sp.co) ?? null;
  const courses = course ? [course] : allCourses;
  const order = sp.o === 'asc' || sp.o === 'desc' ? sp.o : 'rank';
  const cell = (m: string, o: string) => rows.find((r) => r.member_id === m && r.offering_id === o);
  // with one course chosen, the order and rank follow that course's total
  const score = (r: ResultRow) => course ? Number(cell(r.member_id, course.offering_id)?.total ?? 0) : Number(r.average);
  const students = [...new Map(rows.map((r) => [r.member_id, r])).values()].sort((a, b) =>
    order === 'asc' ? score(a) - score(b) : order === 'desc' ? score(b) - score(a) : course ? score(b) - score(a) : a.rank - b.rank);
  const rankOf = new Map(students.map((x) => [x.member_id, course ? 1 + students.filter((y) => score(y) > score(x)).length : x.rank]));
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = q ? students.filter((x) => x.full_name.toLowerCase().includes(q) || (x.reg_no ?? '').toLowerCase().includes(q)) : students;
  const keep = `${q ? `&q=${encodeURIComponent(sp.q!.trim())}` : ''}${course ? `&co=${course.offering_id}` : ''}`;
  const base = `/staff/${dept}/results?s=${semester.id}&c=${cls}${keep}`;
  const picked = sp.m ? rows.filter((r) => r.member_id === sp.m) : [];
  const nextOrder = order === 'desc' ? 'asc' : 'desc';
  const ready = rows[0]?.ready ?? false;

  // A student was clicked: only their detail
  if (picked.length > 0) {
    const p = picked[0];
    const cd = conduct.get(p.member_id)?.conduct as keyof typeof CONDUCT | null | undefined;
    return (
      <section className="card">
        <div className="card-head">
          <b>{p.full_name}</b><span className="small muted">{p.reg_no}</span>
          <span className="spacer" />
          <Link className="btn sm secondary no-print" href={`${base}&o=${order}`} scroll={false}>← ወደ ክፍሉ ዝርዝር</Link>
        </div>
        <div className="stat-row">
          <span><b>{p.rank}/{p.class_size}</b> ደረጃ</span>
          <span><b>{p.average}</b> አማካይ</span>
          <span><b>{cd ?? '—'}</b> ጠባይ{cd ? ` · ${CONDUCT[cd]}` : ''}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ኮርስ</th>{RESULT_PARTS.map((k) => <th key={k.key} className="num">{k.label}</th>)}<th className="num">ድምር</th><th>ውጤት</th><th className="num">ክትትል</th></tr></thead>
            <tbody>
              {picked.map((x) => {
                const g = gradeOf(Number(x.total), semester.pass_mark);
                return (
                  <tr key={x.offering_id}>
                    <td>{x.course}</td>
                    {RESULT_PARTS.map((k) => <td key={k.key} className="num">{x[k.key] ?? '—'}</td>)}
                    <td className={`num ${g.passed ? '' : 'neg'}`}><b>{x.total}</b></td>
                    <td><span className={`pill ${g.passed ? 'present' : 'absent'}`}>{g.label}</span></td>
                    <td className="num">{x.attended}/{x.sessions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dept === 'education' && ready && (
          <div className="btn-row no-print" style={{ marginTop: 12 }}>
            <ActionButton action={openTranscript.bind(null, semester.id, p.member_id)} label="ትራንስክሪፕት" className="btn sm" />
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {allCourses.length > 0 && (
        ready ? <p className="alert ok">✓ ሁሉም ኮርሶች ጸድቀዋል — ተማሪዎች “ትራንስክሪፕትዎ ዝግጁ ነው” የሚል መልእክት ያያሉ።</p>
              : <p className="small muted">ውጤታቸው ገና ያልጸደቀ ኮርሶች፦ {allCourses.filter((c) => c.status !== 'approved').map((c) => c.course).join('፣ ')}</p>
      )}
      <form className="toolbar slim no-print name-filter" action={`/staff/${dept}/results`}>
        <input type="hidden" name="s" value={semester.id} />
        <input type="hidden" name="c" value={cls} />
        <select name="co" defaultValue={course?.offering_id ?? ''} aria-label="ኮርስ">
          <option value="">ሁሉም ኮርሶች</option>
          {allCourses.map((c) => <option key={c.offering_id} value={c.offering_id}>{c.course}</option>)}
        </select>
        <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="🔍 በተማሪ ስም ወይም መለያ ቁ." aria-label="በተማሪ ስም ፈልግ" />
        <button className="btn sm secondary">ፈልግ</button>
        {(q || course) && <Link className="btn sm secondary" href={`/staff/${dept}/results?s=${semester.id}&c=${cls}`}>✕</Link>}
        <span className="small muted">{shown.length}/{students.length} ተማሪዎች</span>
        <AutoSubmit />
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank"><Link className="link" scroll={false} href={base} title="በደረጃ ደርድር">ደረጃ</Link></th><th>ተማሪ</th>
              {courses.map((c) => <th key={c.offering_id} className="num course-col">{c.course}</th>)}
              {!course && <th className="num"><Link className="link" scroll={false} href={`${base}&o=${nextOrder}`} title="በአማካይ ደርድር">አማካይ {order === 'desc' ? '▼' : order === 'asc' ? '▲' : '⇅'}</Link></th>}
              <th className="num" title="በመምህራን የሚሰጥ">ጠባይ</th>
              {dept === 'education' && ready && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.member_id}>
                <td className="rank">{rankOf.get(x.member_id)}</td>
                <td><Link className="link" scroll={false} href={`${base}&o=${order}&m=${x.member_id}`}>{x.full_name}</Link><div className="small muted">{x.reg_no}</div></td>
                {courses.map((c) => {
                  const r = cell(x.member_id, c.offering_id);
                  const g = r ? gradeOf(Number(r.total), semester.pass_mark) : null;
                  return <td key={c.offering_id} className={`num ${g && !g.passed ? 'neg' : ''}`}>{r?.total ?? '—'}</td>;
                })}
                {!course && <td className="num"><b>{x.average}</b></td>}
                <td className="num">{conduct.get(x.member_id)?.conduct ?? <span className="muted">—</span>}</td>
                {dept === 'education' && ready && (
                  <td className="no-print"><ActionButton action={openTranscript.bind(null, semester.id, x.member_id)} label="ትራንስክሪፕት" className="btn xs" /></td>
                )}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={courses.length + 5} className="muted">{q ? 'በዚህ ስም ተማሪ አልተገኘም።' : 'በዚህ ክፍል ተማሪ ወይም ኮርስ የለም።'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">ጠባይ በክፍሉ መምህራን ይሰጣል (A · {CONDUCT.A}፣ B · {CONDUCT.B}፣ C · {CONDUCT.C}፣ D · {CONDUCT.D})።</p>
    </>
  );
}
