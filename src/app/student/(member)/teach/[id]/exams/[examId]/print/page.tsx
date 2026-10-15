import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { EXAM_COLS, QUESTION_COLS, type Exam, type Question } from '@/lib/exams';
import { ExamPrint } from '@/components/exam-print';
import { PrintButton } from '@/components/print-button';

export default async function PrintExam({ params, searchParams }: { params: Promise<{ id: string; examId: string }>; searchParams: Promise<{ key?: string }> }) {
  const { id, examId } = await params;
  const { key } = await searchParams;
  await requireMember();
  const supabase = await createClient();
  const { data: isTeacher } = await supabase.rpc('is_teacher_of', { p_offering: id });
  if (!isTeacher) notFound();
  const [{ data: e }, { data: qs }, { data: o }] = await Promise.all([
    supabase.from('online_exams').select(EXAM_COLS).eq('id', examId).eq('offering_id', id).maybeSingle(),
    supabase.from('exam_questions').select(QUESTION_COLS).eq('exam_id', examId).order('sort').order('created_at'),
    supabase.from('course_offerings').select('name, class_level').eq('id', id).single(),
  ]);
  if (!e || !o) notFound();
  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'flex-end', marginBottom: 10 }}><PrintButton /></div>
      <ExamPrint e={e as Exam} qs={(qs ?? []) as Question[]} course={o.name} classLevel={o.class_level} withKey={key === '1'} />
    </>
  );
}
