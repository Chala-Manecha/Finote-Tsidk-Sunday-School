import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuditEduTabs } from '@/components/audit-edu-tabs';
import { createClient } from '@/lib/supabase/server';
import { COMPONENTS, CONDUCT, classLabel, gradeOf, isClassLevel, semesterLabel, type ResultRow } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { EduPicker } from '@/components/edu-picker';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { PrintButton } from '@/components/print-button';
import { saveConduct, openTranscript } from '@/lib/actions/education-admin';

/** ትምህርት ክፍል: class result sheet, rank, conduct, transcripts. */
export default async function Results({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ s?: string; c?: string; m?: string; o?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const cls = sp.c && isClassLevel(sp.c) ? sp.c : '1';
  const [{ data }, { data: cond }] = await Promise.all([
    supabase.rpc('semester_results', { p_semester: semester.id, p_class: cls }),
    supabase.from('semester_conduct').select('member_id, conduct, remark').eq('semester_id', semester.id),
  ]);
  const rows = (data ?? []) as ResultRow[];
  const courses = [...new Map(rows.map((r) => [r.offering_id, r])).values()];
  const order = sp.o === 'asc' || sp.o === 'desc' ? sp.o : 'rank';
  const students = [...new Map(rows.map((r) => [r.member_id, r])).values()].sort((a, b) =>
    order === 'asc' ? Number(a.average) - Number(b.average) : order === 'desc' ? Number(b.average) - Number(a.average) : a.rank - b.rank);
  const base = `/staff/${dept}/results?s=${semester.id}&c=${cls}`;
  const picked = sp.m ? rows.filter((r) => r.member_id === sp.m) : [];
  const nextOrder = order === 'desc' ? 'asc' : 'desc';
  const cell = (m: string, o: string) => rows.find((r) => r.member_id === m && r.offering_id === o);
  const conduct = new Map((cond ?? []).map((c) => [c.member_id, c]));
  const ready = rows[0]?.ready ?? false;

  return (
    <>
      {dept === 'audit' && <AuditEduTabs current="results" />}
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የተማሪ ውጤት — {classLabel(cls)} · {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</h2>
        <PrintButton />
      </div>
      <EduPicker action={`/staff/${dept}/results`} years={years} semesters={semesters} semesterId={semester.id} classLevel={cls} />
      {courses.length > 0 && (
        ready ? <p className="alert ok">✓ ሁሉም ኮርሶች ጸድቀዋል — ተማሪዎች “ትራንስክሪፕትዎ ዝግጁ ነው” የሚል መልእክት ያያሉ።</p>
              : <p className="small muted">ያልጸደቁ ኮርሶች፦ {courses.filter((c) => c.status !== 'approved').map((c) => c.course).join('፣ ')}</p>
      )}
      {picked.length > 0 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{picked[0].full_name} <span className="small muted">{picked[0].reg_no}</span></h3>
            <Link className="btn sm secondary no-print" href={`${base}&o=${order}`} scroll={false}>✕ ዝጋ</Link>
          </div>
          <p className="small muted">ደረጃ {picked[0].rank}/{picked[0].class_size} · አማካይ <b>{picked[0].average}</b></p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ኮርስ</th>{COMPONENTS.map((k) => <th key={k.key} className="num">{k.label}</th>)}<th className="num">ድምር</th><th>ውጤት</th><th className="num">ክትትል</th></tr></thead>
              <tbody>
                {picked.map((x) => {
                  const g = gradeOf(Number(x.total), semester.pass_mark);
                  return (
                    <tr key={x.offering_id}>
                      <td>{x.course}</td>
                      {COMPONENTS.map((k) => <td key={k.key} className="num">{x[k.key] ?? '—'}</td>)}
                      <td className={`num ${g.passed ? '' : 'neg'}`}><b>{x.total}</b></td>
                      <td><span className={`pill ${g.passed ? 'present' : 'absent'}`}>{g.label}</span></td>
                      <td className="num">{x.attended}/{x.sessions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank"><Link className="link" scroll={false} href={base} title="በደረጃ ደርድር">ደረጃ</Link></th><th>ተማሪ</th>
              {courses.map((c) => <th key={c.offering_id} className="num">{c.course}</th>)}
              <th className="num"><Link className="link" scroll={false} href={`${base}&o=${nextOrder}`} title="በአማካይ ደርድር">አማካይ {order === 'desc' ? '▼' : order === 'asc' ? '▲' : '⇅'}</Link></th>
              {dept === 'education' && <><th className="no-print">ጠባይ</th><th className="no-print" /></>}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.member_id}>
                <td className="rank">{s.rank}</td>
                <td><Link className="link" scroll={false} href={`${base}&o=${order}&m=${s.member_id}`}>{s.full_name}</Link><div className="small muted">{s.reg_no}</div></td>
                {courses.map((c) => {
                  const x = cell(s.member_id, c.offering_id);
                  const g = x ? gradeOf(Number(x.total), semester.pass_mark) : null;
                  return <td key={c.offering_id} className={`num ${g && !g.passed ? 'neg' : ''}`}>{x?.total ?? '—'}</td>;
                })}
                <td className="num"><b>{s.average}</b></td>
                {dept === 'education' && (
                  <>
                    <td className="no-print">
                      <MediaForm action={saveConduct} submitLabel="✓" card={false} resetOnSuccess={false}>
                        <input type="hidden" name="semester_id" value={semester.id} />
                        <input type="hidden" name="member_id" value={s.member_id} />
                        <select name="conduct" defaultValue={conduct.get(s.member_id)?.conduct ?? ''} aria-label="ጠባይ">
                          <option value="">—</option>
                          {Object.entries(CONDUCT).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
                        </select>
                      </MediaForm>
                    </td>
                    <td className="no-print">
                      {ready && <ActionButton action={openTranscript.bind(null, semester.id, s.member_id)} label="ትራንስክሪፕት" className="btn sm" />}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={courses.length + 5} className="muted">በዚህ ክፍል ተማሪ ወይም ኮርስ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">ማለፊያ፦ {semester.pass_mark}/100 · ቀይ = አላለፈም · አማካይ = የኮርሶቹ ውጤት አማካይ · ደረጃ በአማካይ ነው · የተማሪውን ስም ሲጫኑ የሁሉም ኮርሶች ውጤት ይታያል።</p>
    </>
  );
}
