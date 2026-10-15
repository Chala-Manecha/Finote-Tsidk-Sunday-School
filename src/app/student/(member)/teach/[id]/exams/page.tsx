import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { classLabel, semesterLabel } from '@/lib/education';
import { EXAM_COLS, EXAM_COMPONENTS, EXAM_STATUS, EXAM_STATUS_PILL, examWindow, fmtAddis, totalPoints, type Exam } from '@/lib/exams';
import { saveExam } from '@/lib/actions/online-exams';
import { PopForm } from '@/components/pop-form';
import { ExamMetaFields } from '@/components/exam-meta-fields';

/** A teacher's online exams for one course. */
export default async function TeacherExams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember();
  const supabase = await createClient();
  const { data: isTeacher } = await supabase.rpc('is_teacher_of', { p_offering: id });
  if (!isTeacher) notFound();
  const [{ data: o }, { data }] = await Promise.all([
    supabase.from('course_offerings').select('id, name, class_level, semesters(no)').eq('id', id).single(),
    supabase.from('online_exams').select(`${EXAM_COLS}, exam_questions(points), exam_attempts(id, submitted_at)`).eq('offering_id', id).order('opens_at', { ascending: false }),
  ]);
  type Row = Exam & { exam_questions: { points: number }[]; exam_attempts: { id: string; submitted_at: string | null }[] };
  const rows = (data ?? []) as unknown as Row[];
  const sem = (o?.semesters as unknown as { no: number } | null)?.no ?? 1;

  return (
    <>
      <Link className="link small" href={`/student/teach/${id}`}>← {o?.name}</Link>
      <div className="head-row">
        <h1 className="title" style={{ margin: 0 }}>ኦንላይን ፈተናዎች</h1>
        <PopForm label="+ አዲስ ፈተና" action={saveExam} submitLabel="ፍጠርና ጥያቄ ጨምር"><ExamMetaFields offeringId={id} /></PopForm>
      </div>
      <p className="muted small">{o?.name} · {classLabel(o?.class_level ?? '')} · {semesterLabel(sem)} — ያዘጋጁት ፈተና በትምህርት ክፍል ሲጸድቅ ብቻ ለክፍሉ ተማሪዎች ይከፈታል።</p>

      {rows.length === 0 ? <p className="muted card">እስካሁን ኦንላይን ፈተና አላዘጋጁም።</p> : (
        <div className="exam-cards">
          {rows.map((e) => {
            const w = examWindow(e);
            const done = e.exam_attempts.filter((a) => a.submitted_at).length;
            return (
              <Link key={e.id} href={`/student/teach/${id}/exams/${e.id}`} className="exam-card">
                <div className="row"><span className="pill">{EXAM_COMPONENTS[e.component]}</span><span className={`pill ${EXAM_STATUS_PILL[e.status]}`}>{EXAM_STATUS[e.status]}</span></div>
                <h3>{e.title}</h3>
                <div className="small muted">{fmtAddis(e.opens_at, { weekday: true })} → {fmtAddis(e.closes_at)}</div>
                <div className="nums">
                  <div><b>{e.exam_questions.length}</b>ጥያቄ</div>
                  <div><b>{totalPoints(e.exam_questions)}</b>ነጥብ</div>
                  <div><b>{e.duration_min}′</b>ደቂቃ</div>
                  <div><b>{done}</b>አስረክበዋል</div>
                </div>
                {e.status === 'approved' && <span className={`small ${w === 'open' ? 'pos' : 'muted'}`}>{w === 'open' ? '● አሁን ክፍት ነው' : w === 'upcoming' ? 'ገና ይከፈታል' : e.pushed_at ? '✓ ውጤቱ ተልኳል' : 'ተዘግቷል — ውጤቱን ይላኩ'}</span>}
                {e.status === 'rejected' && e.review_note && <span className="small neg">↩ {e.review_note}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
