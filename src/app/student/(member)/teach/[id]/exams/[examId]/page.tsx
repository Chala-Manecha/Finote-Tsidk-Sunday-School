import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { classLabel } from '@/lib/education';
import {
  COMPONENT_WEIGHT, EXAM_COLS, EXAM_COMPONENTS, EXAM_STATUS, QUESTION_COLS, QUESTION_KINDS,
  answerText, examWindow, fmtAddis, givenText, totalPoints, type Exam, type Question,
} from '@/lib/exams';
import { deleteExam, deleteQuestion, moveQuestion, pushResults, saveExam, saveManualPoints, setExamStatus } from '@/lib/actions/online-exams';
import { ActionButton } from '@/components/action-button';
import { MediaForm } from '@/components/media-form';
import { ExamMetaFields } from '@/components/exam-meta-fields';
import { QuestionForm } from '@/components/exam-question-form';
import { SegLinks } from '@/components/seg-links';

type Attempt = {
  id: string; member_id: string; started_at: string; deadline: string; submitted_at: string | null; auto_submitted: boolean;
  answers: Record<string, unknown>; flags: string[]; left_count: number; auto_points: Record<string, number> | null;
  manual_points: Record<string, number>; score: number | null;
};

/** One exam: questions (while draft), approval status, then the students' papers and marking. */
export default async function TeacherExam({ params, searchParams }: {
  params: Promise<{ id: string; examId: string }>; searchParams: Promise<{ v?: string }>;
}) {
  const { id, examId } = await params;
  const sp = await searchParams;
  await requireMember();
  const supabase = await createClient();
  const { data: isTeacher } = await supabase.rpc('is_teacher_of', { p_offering: id });
  if (!isTeacher) notFound();
  const { data: ex } = await supabase.from('online_exams').select(EXAM_COLS).eq('id', examId).eq('offering_id', id).maybeSingle();
  if (!ex) notFound();
  const e = ex as Exam;
  const view = sp.v === 'results' || (sp.v !== 'questions' && e.status === 'approved' && examWindow(e) !== 'upcoming') ? 'results' : 'questions';
  const editable = e.status === 'draft' || e.status === 'rejected';
  const [{ data: qd }, { data: o }] = await Promise.all([
    supabase.from('exam_questions').select(QUESTION_COLS).eq('exam_id', examId).order('sort').order('created_at'),
    supabase.from('course_offerings').select('name, class_level, semesters(year_id, w_quiz, w_mid, w_final)').eq('id', id).single(),
  ]);
  const qs = (qd ?? []) as Question[];
  const total = totalPoints(qs);
  const sem = o?.semesters as unknown as { year_id: string; w_quiz: number; w_mid: number; w_final: number };
  const weight = sem[COMPONENT_WEIGHT[e.component]];
  const base = `/student/teach/${id}/exams/${examId}`;

  return (
    <>
      <Link className="link small" href={`/student/teach/${id}/exams`}>← ኦንላይን ፈተናዎች · {o?.name}</Link>
      <div className="head-row">
        <h1 className="title" style={{ margin: 0 }}>{e.title}</h1>
        <span className="btn-row">
          <a className="btn sm secondary" href={`${base}/print`} target="_blank" rel="noopener">🖨 የፈተና ወረቀት</a>
          <a className="btn sm secondary" href={`${base}/print?key=1`} target="_blank" rel="noopener">🖨 ከመልስ ጋር</a>
        </span>
      </div>
      <p className="muted small">
        {EXAM_COMPONENTS[e.component]} · {o?.name} ({classLabel(o?.class_level ?? '')}) · {qs.length} ጥያቄ · {total} ነጥብ → ወደ ማርክ ሉህ ከ{weight} · {e.duration_min} ደቂቃ ·
        {' '}{fmtAddis(e.opens_at, { weekday: true })} → {fmtAddis(e.closes_at)}
      </p>

      <div className={`status-banner ${e.status}`}>
        <span>
          <b>{EXAM_STATUS[e.status]}</b>
          {e.status === 'draft' && ' — ጥያቄዎቹን ሲጨርሱ ለትምህርት ክፍል ያስጸድቁ።'}
          {e.status === 'submitted' && ' — ትምህርት ክፍል እስኪያጸድቅ ይጠብቁ። ለማስተካከል መልሰው ይውሰዱት።'}
          {e.status === 'rejected' && <> — ትምህርት ክፍል መልሶታል፦ <i>{e.review_note}</i></>}
          {e.status === 'approved' && (examWindow(e) === 'upcoming' ? ' — በተወሰነው ሰዓት ለተማሪዎች ይከፈታል።' : examWindow(e) === 'open' ? ' — አሁን ክፍት ነው።' : ' — ተዘግቷል።')}
        </span>
        <span className="btn-row">
          {editable && <ActionButton action={setExamStatus.bind(null, examId, id, 'submitted')} label="📤 ለትምህርት ክፍል ላክ" className="btn sm green"
            confirmText="ከተላከ በኋላ እስኪመለስ ድረስ መቀየር አይቻልም። ይላክ?" />}
          {e.status === 'submitted' && <ActionButton action={setExamStatus.bind(null, examId, id, 'draft')} label="↩ መልሰህ ውሰድ" className="btn sm secondary" />}
          {editable && <ActionButton action={deleteExam.bind(null, examId, id)} label="ፈተናውን አጥፋ" className="btn sm danger" confirmText="ፈተናው ከነጥያቄዎቹ ይጥፋ?" />}
        </span>
      </div>

      {e.status === 'approved' && <SegLinks current={view} items={[['questions', `📝 ጥያቄዎች (${qs.length})`, `${base}?v=questions`], ['results', '📊 ውጤትና እርማት', `${base}?v=results`]]} />}

      {view === 'questions' && (
        <>
          {editable && (
            <details className="card fold-card" style={{ marginBottom: 12 }}>
              <summary><b>⚙ የፈተናው መረጃ</b> <span className="small muted">— ርዕስ፣ አይነት፣ ጊዜ</span></summary>
              <div style={{ marginTop: 10 }}>
                <MediaForm action={saveExam} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}><ExamMetaFields offeringId={id} e={e} /></MediaForm>
              </div>
            </details>
          )}
          <div className="q-list">
            {qs.map((q, i) => (
              <div key={q.id} className="q-item">
                <div className="q-head">
                  <span><b>{i + 1}.</b> <span className="pill">{QUESTION_KINDS[q.kind]}</span></span>
                  <span className="small"><b>{Number(q.points)}</b> ነጥብ</span>
                </div>
                <div className="q-prompt">{q.prompt}</div>
                {q.kind === 'choice' && <ol type="A">{(q.options as string[]).map((t, k) => <li key={k} className={k === Number(q.answer) ? 'ok' : ''}>{t}</li>)}</ol>}
                {q.kind === 'match' && (
                  <table className="small" style={{ marginTop: 6 }}>
                    <tbody>{(q.options as { left: string[]; right: string[] }).left.map((l, k) => <tr key={k}><td>{k + 1}. {l}</td><td>↔ {(q.options as { right: string[] }).right[k]}</td></tr>)}</tbody>
                  </table>
                )}
                {q.kind !== 'choice' && q.kind !== 'match' && <div className="q-key">✓ {answerText(q)}</div>}
                {editable && (
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <details className="pop">
                      <summary className="btn xs secondary">አርም</summary>
                      <div className="pop-body wide"><QuestionForm examId={examId} offeringId={id} q={q} /></div>
                    </details>
                    {i > 0 && <ActionButton action={moveQuestion.bind(null, q.id, examId, id, -1)} label="↑" className="btn xs secondary" />}
                    {i < qs.length - 1 && <ActionButton action={moveQuestion.bind(null, q.id, examId, id, 1)} label="↓" className="btn xs secondary" />}
                    <ActionButton action={deleteQuestion.bind(null, q.id, examId, id)} label="አጥፋ" className="btn xs danger" confirmText="ጥያቄው ይጥፋ?" />
                  </div>
                )}
              </div>
            ))}
            {qs.length === 0 && <p className="muted">እስካሁን ጥያቄ የለም።</p>}
          </div>
          {editable && (
            <section className="card" style={{ marginTop: 14 }}>
              <h3 style={{ marginTop: 0 }}>+ አዲስ ጥያቄ</h3>
              <QuestionForm examId={examId} offeringId={id} />
            </section>
          )}
        </>
      )}

      {view === 'results' && <Results e={e} qs={qs} total={total} weight={weight} offeringId={id} yearId={sem.year_id} classLevel={o?.class_level ?? ''} />}
    </>
  );
}

async function Results({ e, qs, total, weight, offeringId, yearId, classLevel }: {
  e: Exam; qs: Question[]; total: number; weight: number; offeringId: string; yearId: string; classLevel: string;
}) {
  const supabase = await createClient();
  await supabase.rpc('close_expired_attempts', { p_exam: e.id });
  const [{ data: att }, { data: enr }] = await Promise.all([
    supabase.from('exam_attempts').select('id, member_id, started_at, deadline, submitted_at, auto_submitted, answers, flags, left_count, auto_points, manual_points, score').eq('exam_id', e.id),
    supabase.from('enrollments').select('member_id').eq('year_id', yearId).eq('class_level', classLevel),
  ]);
  const attempts = (att ?? []) as Attempt[];
  const ids = [...new Set([...(enr ?? []).map((x) => x.member_id), ...attempts.map((a) => a.member_id)])];
  const { data: names } = ids.length ? await supabase.rpc('member_names', { p_ids: ids }) : { data: [] };
  const nameOf = new Map(((names ?? []) as { id: string; full_name: string; reg_no: string }[]).map((n) => [n.id, n]));
  const byMember = new Map(attempts.map((a) => [a.member_id, a]));
  const students = ids.map((mid) => ({ id: mid, name: nameOf.get(mid)?.full_name ?? '—', reg: nameOf.get(mid)?.reg_no ?? '', a: byMember.get(mid) }))
    .sort((x, y) => x.name.localeCompare(y.name, 'am'));
  const submitted = attempts.filter((a) => a.submitted_at);
  const avg = submitted.length ? Math.round((submitted.reduce((t, a) => t + Number(a.score ?? 0), 0) / submitted.length) * 100) / 100 : null;
  const pct = (s: number | null) => (s === null || !total ? '—' : `${Math.round((Number(s) / total) * 100)}%`);
  const closed = examWindow(e) === 'closed';

  return (
    <>
      <div className="stat-cards">
        <span className="stat-card"><b>{students.length}</b>የክፍሉ ተማሪዎች</span>
        <span className="stat-card"><b>{submitted.length}</b>አስረክበዋል</span>
        <span className="stat-card"><b>{attempts.length - submitted.length}</b>በመፈተን ላይ</span>
        <span className="stat-card"><b>{students.length - attempts.length}</b>ያልጀመሩ</span>
        <span className="stat-card"><b>{avg ?? '—'}<small>/{total}</small></b>አማካይ</span>
      </div>
      <div className="status-banner" style={{ marginTop: 12 }}>
        <span className="small">
          ምርጫ፣ እውነት/ሐሰት፣ ባዶ ቦታና አዛምድ በራሳቸው ይታረማሉ። ሌላ ትክክለኛ መልስ ካለ ተማሪውን ከፍተው ነጥቡን ያስተካክሉ።
          ውጤቱ ወደ ማርክ ሉህ የሚገባው <b>(ነጥብ ÷ {total}) × {weight}</b> ሆኖ ነው{e.component === 'quiz' ? '፤ ብዙ Quiz ካለ የተፈተኑት አማካይ ይገባል' : ''}።
          {e.pushed_at && <> ለመጨረሻ ጊዜ የተላከው፦ {fmtAddis(e.pushed_at)}።</>}
        </span>
        <ActionButton action={pushResults.bind(null, e.id)} label={e.pushed_at ? '↻ ውጤቱን እንደገና ላክ' : '📥 ውጤቱን ወደ ማርክ ሉህ ላክ'} className="btn sm green"
          confirmText={`${submitted.length} ተማሪዎች ያስረከቡት ውጤት በ“${EXAM_COMPONENTS[e.component]}” ዓምድ ይግባ? ${closed ? '' : 'ፈተናው ገና አልተዘጋም — ያልጨረሱ አይካተቱም።'} ውጤቱን ተማሪዎችም ያዩታል።`} />
      </div>

      <div className="abs-list">
        <div className="abs-head"><span>ተማሪ</span><span className="num">ነጥብ</span><span className="num">ሁኔታ</span></div>
        {students.map((s) => {
          const a = s.a;
          const status = !a ? 'ያልጀመረ' : !a.submitted_at ? 'በመፈተን ላይ' : a.auto_submitted ? 'ሰዓቱ ሲያልቅ ገብቷል' : 'አስረክቧል';
          return (
            <details key={s.id} className="abs-row">
              <summary>
                <span><b>{s.name}</b> <span className="small muted">{s.reg}</span>{a && a.left_count > 0 && <span className="small neg" title="ከፈተናው ገጽ የወጣበት ጊዜ"> · ⚠ {a.left_count} ጊዜ ወጥቷል</span>}</span>
                <span className="num">{a?.submitted_at ? <><b>{Number(a.score ?? 0)}</b>/{total} <span className="small muted">{pct(a.score)}</span></> : '—'}</span>
                <span className="num small">{status}</span>
              </summary>
              {a?.submitted_at ? (
                <MediaForm action={saveManualPoints} submitLabel="ማስተካከያ አስቀምጥ" card={false} resetOnSuccess={false}>
                  <input type="hidden" name="attempt_id" value={a.id} />
                  <input type="hidden" name="exam_id" value={e.id} />
                  <input type="hidden" name="offering_id" value={offeringId} />
                  <p className="small muted" style={{ margin: '6px 0' }}>ጀመረ፦ {fmtAddis(a.started_at)} · አስረከበ፦ {fmtAddis(a.submitted_at)}</p>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>ጥያቄ</th><th>የተማሪው መልስ</th><th>ትክክለኛው</th><th className="num">በራሱ</th><th className="num">የእርስዎ ነጥብ</th></tr></thead>
                      <tbody>
                        {qs.map((q, i) => {
                          const auto = Number(a.auto_points?.[q.id] ?? 0);
                          return (
                            <tr key={q.id}>
                              <td>{i + 1}{a.flags.includes(q.id) ? ' 🚩' : ''}</td>
                              <td className="small">{q.prompt.length > 80 ? `${q.prompt.slice(0, 80)}…` : q.prompt}</td>
                              <td className={`small ${auto >= Number(q.points) ? 'pos' : auto > 0 ? '' : 'neg'}`}>{givenText(q, a.answers[q.id])}</td>
                              <td className="small muted">{answerText(q)}</td>
                              <td className="num">{auto}/{Number(q.points)}</td>
                              <td className="num">
                                <input name={`pts_${q.id}`} type="number" min={0} max={Number(q.points)} step={0.25} style={{ width: 70 }}
                                  defaultValue={a.manual_points[q.id] ?? ''} placeholder={String(auto)} aria-label={`ጥያቄ ${i + 1} ነጥብ`} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </MediaForm>
              ) : <p className="small muted" style={{ margin: 8 }}>{a ? `የጀመረው ${fmtAddis(a.started_at)} · ሰዓቱ የሚያልቀው ${fmtAddis(a.deadline)}` : 'ፈተናውን አልጀመረም።'}</p>}
            </details>
          );
        })}
      </div>
      <p className="small muted">ባዶ “የእርስዎ ነጥብ” = በራሱ የተሰጠው ነጥብ ይቆጠራል።</p>
    </>
  );
}
