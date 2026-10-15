import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { classLabel, semesterLabel } from '@/lib/education';
import { EXAM_COLS, EXAM_COMPONENTS, EXAM_STATUS, EXAM_STATUS_PILL, examWindow, fmtAddis, totalPoints, type Exam, type ExamStatus } from '@/lib/exams';
import { approveExams } from '@/lib/actions/online-exams';
import { PickList } from '@/components/pick-list';

type Row = Exam & {
  exam_questions: { points: number }[]; exam_attempts: { submitted_at: string | null }[];
  course_offerings: { name: string; class_level: string; semesters: { no: number; academic_years: { ec_year: number; is_active: boolean } } };
};

/** ትምህርት ክፍል: approve teachers' online exams (all at once or one by one) and follow them. */
export default async function OnlineExams({ params, searchParams }: { params: Promise<{ dept: string }>; searchParams: Promise<{ st?: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const st: ExamStatus = sp.st === 'approved' || sp.st === 'rejected' ? sp.st : 'submitted';
  const supabase = await createClient();
  const { data } = await supabase.from('online_exams')
    .select(`${EXAM_COLS}, exam_questions(points), exam_attempts(submitted_at), course_offerings!inner(name, class_level, semesters!inner(no, academic_years!inner(ec_year, is_active)))`)
    .eq('course_offerings.semesters.academic_years.is_active', true)
    .in('status', ['submitted', 'approved', 'rejected']).order('opens_at');
  const all = (data ?? []) as unknown as Row[];
  const count = (s: ExamStatus) => all.filter((e) => e.status === s).length;
  const rows = all.filter((e) => e.status === st);
  const base = '/staff/education/online-exams';
  const label = (e: Row) => `${e.course_offerings.name} · ${classLabel(e.course_offerings.class_level)} · ${semesterLabel(e.course_offerings.semesters.no)}`;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ኦንላይን ፈተናዎች</h2>
      <div className="stat-cards">
        {(['submitted', 'approved', 'rejected'] as ExamStatus[]).map((s) => (
          <Link key={s} className={`stat-card ${st === s ? 'on' : ''}`} href={`${base}?st=${s}`}><b>{count(s)}</b>{s === 'submitted' ? 'ለማጽደቅ የቀረቡ' : EXAM_STATUS[s]}</Link>
        ))}
      </div>
      <p className="small muted">መምህራን ያዘጋጁትን ፈተና ይመልከቱ (ጥያቄና መልስ)፣ ከዚያ ያጽድቁ ወይም በምክንያት ይመልሱ። የጸደቀ ፈተና በተወሰነው ሰዓት ለክፍሉ ተማሪዎች ብቻ ይከፈታል።</p>

      {st === 'submitted' ? (
        <section className="card">
          <PickList action={approveExams} hidden={{}} button="✓ የተመረጡትን አጽድቅ" empty="ለማጽደቅ የቀረበ ፈተና የለም።"
            rows={rows.map((e) => ({
              id: e.id, name: e.title, href: `${base}/${e.id}`, sub: `${EXAM_COMPONENTS[e.component]} · ${label(e)}`,
              extra: `${e.exam_questions.length} ጥያቄ · ${totalPoints(e.exam_questions)} ነጥብ · ${e.duration_min}′ · ${fmtAddis(e.opens_at)}`,
            }))} />
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ፈተና</th><th>ኮርስ</th><th>መክፈቻ → መዝጊያ</th><th className="num">ያስረከቡ</th><th>ሁኔታ</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const w = examWindow(e);
                return (
                  <tr key={e.id}>
                    <td><Link className="link" href={`${base}/${e.id}`}><b>{e.title}</b></Link><div className="small muted">{EXAM_COMPONENTS[e.component]} · {e.exam_questions.length} ጥያቄ · {totalPoints(e.exam_questions)} ነጥብ</div></td>
                    <td className="small">{label(e)}</td>
                    <td className="small">{fmtAddis(e.opens_at)} → {fmtAddis(e.closes_at)}</td>
                    <td className="num">{e.exam_attempts.filter((a) => a.submitted_at).length}</td>
                    <td>
                      <span className={`pill ${EXAM_STATUS_PILL[e.status]}`}>{EXAM_STATUS[e.status]}</span>
                      {e.status === 'approved' && <div className="small muted">{w === 'open' ? '● ክፍት' : w === 'upcoming' ? 'ገና ይከፈታል' : e.pushed_at ? 'ውጤቱ ተልኳል' : 'ተዘግቷል'}</div>}
                      {e.status === 'rejected' && e.review_note && <div className="small muted">{e.review_note}</div>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="muted">ምንም የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
