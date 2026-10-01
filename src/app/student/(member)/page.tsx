import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import {
  COMPONENTS, DECISION, READY_MESSAGE, THANKSGIVING, classLabel, gradeOf, semesterLabel,
  type AcademicYear, type ResultRow, type Semester, type YearRow,
} from '@/lib/education';
import { ActionButton } from '@/components/action-button';
import { enrollSelf } from '@/lib/actions/student-auth';

export default async function StudentHome() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data: yearData } = await supabase.from('academic_years').select('id, ec_year, is_active').eq('is_active', true).maybeSingle();
  const year = yearData as AcademicYear | null;

  const [{ data: semData }, { data: enr }, { data: teach }] = await Promise.all([
    year ? supabase.from('semesters').select('*').eq('year_id', year.id).order('no') : Promise.resolve({ data: [] }),
    year ? supabase.from('enrollments').select('class_level').eq('year_id', year.id).eq('member_id', me.memberId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('offering_teachers').select('course_offerings(id, name, class_level, status, semesters(no, academic_years(ec_year, is_active)))').eq('member_id', me.memberId),
  ]);
  const semesters = (semData ?? []) as Semester[];
  const classLevel = (enr as { class_level: string | null } | null)?.class_level ?? null;

  const results = classLevel
    ? await Promise.all(semesters.map(async (s) => {
        const { data } = await supabase.rpc('semester_results', { p_semester: s.id, p_class: classLevel });
        return { s, rows: (data ?? []) as ResultRow[] };
      }))
    : [];

  const yearRow = classLevel && year
    ? (((await supabase.rpc('year_results', { p_year: year.id, p_class: classLevel })).data ?? []) as YearRow[])[0]
    : undefined;

  type T = { course_offerings: { id: string; name: string; class_level: string; status: string;
    semesters: { no: number; academic_years: { ec_year: number; is_active: boolean } } } | null };
  const teaching = ((teach ?? []) as unknown as T[]).map((t) => t.course_offerings!).filter(Boolean)
    .filter((o) => o.semesters.academic_years.is_active);

  return (
    <>
      <h1 className="title" style={{ marginTop: 0 }}>ሰላም፣ {me.fullName}</h1>
      <p className="muted small">መለያ ቁ. {me.regNo}</p>

      {teaching.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 className="section" style={{ marginTop: 0 }}>የማስተምራቸው ክፍሎች</h2>
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {teaching.map((o) => (
              <Link key={o.id} className="btn secondary" href={`/student/teach/${o.id}`}>
                {o.name} · {classLabel(o.class_level)} · {semesterLabel(o.semesters.no)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <h2 className="section">የእኔ ትምህርት</h2>
      {!year && <p className="muted">የትምህርት ዘመኑ ገና አልተከፈተም።</p>}
      {year && !enr && (
        <div className="card">
          <p style={{ marginTop: 0 }}>ለ{year.ec_year} ዓ.ም የትምህርት ዘመን አልተመዘገቡም።</p>
          <ActionButton action={enrollSelf} label={`ለ${year.ec_year} ዓ.ም ተመዝገብ`} className="btn" />
        </div>
      )}
      {year && enr && !classLevel && (
        <p className="alert ok">ለ{year.ec_year} ዓ.ም ተመዝግበዋል። ክፍልዎን ትምህርት ክፍል በቅርቡ ይመድባል።</p>
      )}

      {classLevel && <p><b>{classLabel(classLevel)}</b> · {year?.ec_year} ዓ.ም</p>}
      {yearRow?.ready && (
        <section className="card" style={{ marginBottom: 16, borderColor: 'var(--gold)' }}>
          <h3 style={{ marginTop: 0 }}>የ{year?.ec_year} ዓ.ም የዓመት ውጤት</h3>
          <div className="alert ok">
            <div><b>{READY_MESSAGE}</b></div>
            <div className="serif">{THANKSGIVING}</div>
          </div>
          <p>
            የዓመት አማካይ፦ <b>{yearRow.year_average}</b> · ደረጃ በክፍል፦ <b>{yearRow.rank} ከ{yearRow.class_size}</b> · ውሳኔ፦{' '}
            <b className={yearRow.decision === 'repeat' ? 'neg' : 'pos'}>{yearRow.decision ? DECISION[yearRow.decision] : '—'}</b>
            {yearRow.rank !== null && yearRow.rank <= 3 && ' 🏅'}
          </p>
        </section>
      )}
      {results.map(({ s, rows }) => (
        <section key={s.id} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{semesterLabel(s.no)}</h3>
          {rows.length > 0 && rows[0].ready && (
            <div className="alert ok">
              <div><b>{READY_MESSAGE}</b></div>
              <div className="serif">{THANKSGIVING}</div>
            </div>
          )}
          <p className="small muted">
            የውጤት አያያዝ፦ ፈተና {s.w_quiz} · ደብተር {s.w_notebook} · ተሣትፎ {s.w_participation} · አጋማሽ {s.w_mid} · ዋና {s.w_final} = 100 · ማለፊያ {s.pass_mark}
          </p>
          {rows.length === 0 ? <p className="muted">ለዚህ ወሰነ ትምህርት ኮርሶች ገና አልተዘጋጁም።</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>ኮርስ</th>{COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}</th>)}<th className="num">ድምር</th><th>ደረጃ</th><th className="num">ክትትል</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.offering_id}>
                      <td>{r.course}</td>
                      {r.status === 'approved'
                        ? <>{COMPONENTS.map((c) => <td key={c.key} className="num">{r[c.key] ?? '—'}</td>)}
                            <td className="num"><b>{r.total}</b></td><td>{gradeOf(Number(r.total), s.pass_mark).label}</td></>
                        : <td colSpan={COMPONENTS.length + 2} className="muted small">ውጤቱ ገና አልጸደቀም።</td>}
                      <td className="num">{r.sessions ? `${Math.round((r.attended / r.sessions) * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && rows[0].ready && (
            <p><b>አማካይ፦</b> {rows[0].average} · <b>ደረጃ በክፍል፦</b> {rows[0].rank} ከ{rows[0].class_size}</p>
          )}
        </section>
      ))}
    </>
  );
}
