import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { QUESTION_KINDS, answerText, givenText, type Question } from '@/lib/exams';
import { PrintButton } from '@/components/print-button';

type R = { title: string; score: number; total: number; questions: (Pick<Question, 'prompt' | 'kind' | 'points' | 'options' | 'answer'> & { given: unknown; got: number })[] };

/** After the teacher sends the result: the student's own paper with the right answers. */
export default async function ExamReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_exam_review', { p_exam: id });
  const r = data as R | null;
  if (!r) notFound();
  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between' }}>
        <Link className="link small" href={`/student/exam/${id}`}>← ተመለስ</Link><PrintButton />
      </div>
      <h1 className="title">{r.title}</h1>
      <p className="exam-score"><b>{Number(r.score)}</b> / {Number(r.total)}</p>
      <div className="q-list">
        {r.questions.map((q, i) => {
          const full = Number(q.got) >= Number(q.points);
          return (
            <div key={i} className={`q-item ${full ? 'right' : Number(q.got) > 0 ? 'part' : 'wrong'}`}>
              <div className="q-head"><span><b>{i + 1}.</b> <span className="pill">{QUESTION_KINDS[q.kind]}</span></span><span><b>{Number(q.got)}</b>/{Number(q.points)}</span></div>
              <div className="q-prompt">{q.prompt}</div>
              <div className="small">የእርስዎ መልስ፦ <b>{givenText(q, q.given)}</b></div>
              {!full && <div className="q-key">✓ ትክክለኛው፦ {answerText(q)}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
