import { DocHeader } from './doc-sheet';
import { classLabel } from '@/lib/education';
import { EXAM_COMPONENTS, LETTERS, QUESTION_KINDS, answerText, fmtAddis, totalPoints, type Exam, type Question } from '@/lib/exams';

/** Printable exam paper (optionally with the answer key) — same order as the teacher set. */
export function ExamPrint({ e, qs, course, classLevel, withKey }: { e: Exam; qs: Question[]; course: string; classLevel: string; withKey: boolean }) {
  let no = 0; // numbered 1… across the sections (grouped by question type)
  return (
    <article className="doc-sheet exam-print">
      <DocHeader title={`${EXAM_COMPONENTS[e.component]}${withKey ? ' — የመልስ ቁልፍ' : ''}`} code={e.title} />
      <div className="exam-print-meta">
        <span>ኮርስ፦ <b>{course}</b></span><span>ክፍል፦ <b>{classLabel(classLevel)}</b></span>
        <span>ጊዜ፦ <b>{e.duration_min} ደቂቃ</b></span><span>ጠቅላላ፦ <b>{totalPoints(qs)} ነጥብ</b></span>
        <span>ቀን፦ <b>{fmtAddis(e.opens_at)}</b></span>
      </div>
      {!withKey && <div className="exam-print-name"><span>ስም፦ ______________________________</span><span>መለያ ቁ. ____________</span><span>ውጤት፦ ______ / {totalPoints(qs)}</span></div>}
      {e.instructions && <p className="exam-print-ins"><b>መመሪያ፦</b> {e.instructions}</p>}
      {(['choice', 'tf', 'blank', 'match'] as const).map((kind) => {
        const list = qs.filter((q) => q.kind === kind).map((q) => ({ q, n: (no += 1) }));
        if (!list.length) return null;
        return (
          <section key={kind} className="exam-print-sec">
            <h3>{QUESTION_KINDS[kind]} <span className="small muted">({totalPoints(list.map((x) => x.q))} ነጥብ)</span></h3>
            {list.map(({ q, n }) => (
              <div key={q.id} className="exam-print-q">
                <div><b>{n}.</b> {kind === 'tf' && !withKey && <span className="tf-box">____ </span>}{q.prompt} <span className="small muted">({Number(q.points)})</span></div>
                {kind === 'choice' && (
                  <ol type="A" className="exam-print-opts">
                    {(q.options as string[]).map((t, k) => <li key={k} className={withKey && k === Number(q.answer) ? 'ok' : ''}>{t}</li>)}
                  </ol>
                )}
                {kind === 'match' && (
                  <div className="exam-print-match">
                    <ol>{(q.options as { left: string[] }).left.map((l, k) => <li key={k}>{l} ______</li>)}</ol>
                    <ol type="A">{(q.options as { right: string[] }).right.map((r, k) => <li key={k}>{r}</li>)}</ol>
                  </div>
                )}
                {withKey && <div className="q-key">✓ {kind === 'match'
                  ? (q.answer as number[]).map((r, k) => `${k + 1}→${LETTERS[r]}`).join(' · ')
                  : answerText(q)}</div>}
              </div>
            ))}
          </section>
        );
      })}
    </article>
  );
}
