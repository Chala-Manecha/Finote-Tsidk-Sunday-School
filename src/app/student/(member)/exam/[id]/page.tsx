import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { examWindow, fmtAddis, type MyExam } from '@/lib/exams';
import { ExamRunner } from '@/components/exam-runner';



/** The student's exam: wait, sit it (resumes where it stopped), or see that it is handed in. */
export default async function StudentExam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_exams');
  const x = ((data ?? []) as MyExam[]).find((r) => r.id === id);
  if (!x) notFound();
  const w = examWindow(x);
  const info = { id: x.id, title: x.title, component: x.component, course: x.course, duration_min: x.duration_min, questions: x.questions, total_points: x.total_points };
  const inProgress = !!x.attempt_id && !x.submitted_at;

  let body: React.ReactNode;
  if (x.submitted_at) {
    body = (
      <section className="card exam-intro">
        <div style={{ fontSize: '2.2rem' }}>✅</div>
        <h1 className="serif">{x.title}</h1>
        <p>ያስረከቡት {fmtAddis(x.submitted_at)}።</p>
        {x.released
          ? <><p className="exam-score"><b>{Number(x.score ?? 0)}</b> / {Number(x.total_points)}</p><Link className="btn" href={`/student/exam/${x.id}/review`}>የታረመውን ወረቀት እይ</Link></>
          : <p className="muted">ውጤቱ መምህሩ ሲልከው እዚህ ይታያል።</p>}
      </section>
    );
  } else if (!inProgress && w === 'closed') {
    body = <section className="card exam-intro"><h1 className="serif">{x.title}</h1><p>የፈተናው ጊዜ አልፏል ({fmtAddis(x.closes_at)})።</p></section>;
  } else {
    body = <ExamRunner info={info} resume={inProgress} locked={!inProgress && !x.unlocked} />;
  }

  return (
    <>
      <Link className="link small no-print" href="/student">← ዳሽቦርድ</Link>
      {body}
    </>
  );
}
