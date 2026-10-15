import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EXAM_COLS, EXAM_STATUS, QUESTION_COLS, fmtAddis, totalPoints, type Exam, type Question } from '@/lib/exams';
import { decideExam, rejectExam } from '@/lib/actions/online-exams';
import { ExamPrint } from '@/components/exam-print';
import { ActionButton } from '@/components/action-button';
import { PopForm } from '@/components/pop-form';
import { PrintButton } from '@/components/print-button';

/** ትምህርት ክፍል reviews one exam (questions with the key) and approves or returns it. */
export default async function ReviewExam({ params }: { params: Promise<{ dept: string; examId: string }> }) {
  const { dept, examId } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const { data: e } = await supabase.from('online_exams').select(`${EXAM_COLS}, course_offerings(name, class_level, offering_teachers(members(full_name)))`).eq('id', examId).maybeSingle();
  if (!e) notFound();
  const exam = e as unknown as Exam & { course_offerings: { name: string; class_level: string; offering_teachers: { members: { full_name: string } | null }[] } };
  const [{ data: qs }, { data: att }] = await Promise.all([
    supabase.from('exam_questions').select(QUESTION_COLS).eq('exam_id', examId).order('sort').order('created_at'),
    supabase.from('exam_attempts').select('score, submitted_at').eq('exam_id', examId),
  ]);
  const questions = (qs ?? []) as Question[];
  const done = (att ?? []).filter((a) => a.submitted_at);
  const total = totalPoints(questions);
  const avg = done.length ? Math.round((done.reduce((t, a) => t + Number(a.score ?? 0), 0) / done.length) * 100) / 100 : null;
  const teachers = exam.course_offerings.offering_teachers.map((t) => t.members?.full_name).filter(Boolean).join('፣ ');

  return (
    <>
      <div className="crumb no-print"><Link href="/staff/education/online-exams">ኦንላይን ፈተናዎች</Link> › {exam.title}</div>
      <div className={`status-banner no-print ${exam.status}`}>
        <span>
          <b>{EXAM_STATUS[exam.status]}</b> · መምህር፦ {teachers || '—'}
          {exam.submitted_at && <> · የቀረበው {fmtAddis(exam.submitted_at)}</>}
          {exam.status === 'approved' && <> · ያስረከቡ {done.length}{avg !== null && <> · አማካይ {avg}/{total}</>}</>}
        </span>
        <span className="btn-row">
          {exam.status === 'submitted' && (
            <>
              <ActionButton action={decideExam.bind(null, examId, 'approved')} label="✓ አጽድቅ" className="btn sm green" />
              <PopForm label="↩ መልስ" action={rejectExam} submitLabel="ለመምህሩ መልስ">
                <input type="hidden" name="id" value={examId} />
                <div className="field"><label htmlFor="rn">ምክንያት / የሚስተካከለው</label><textarea id="rn" name="review_note" rows={3} required maxLength={500} /></div>
              </PopForm>
            </>
          )}
          {exam.status === 'approved' && (att ?? []).length === 0 && (
            <ActionButton action={decideExam.bind(null, examId, 'draft')} label="ማጽደቁን አንሳ (ለመምህሩ ክፈት)" className="btn sm secondary"
              confirmText="ፈተናው ወደ ረቂቅ ተመልሶ መምህሩ ሊያስተካክለው ይችላል። ይቀጥል?" />
          )}
          <PrintButton />
        </span>
      </div>
      <ExamPrint e={exam} qs={questions} course={exam.course_offerings.name} classLevel={exam.course_offerings.class_level} withKey />
    </>
  );
}
