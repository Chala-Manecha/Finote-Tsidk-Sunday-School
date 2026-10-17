import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { classLabel, semesterLabel } from '@/lib/education';
import { formatEc } from '@/lib/ethiopian-calendar';
import { DocHeader } from '@/components/doc-sheet';
import { PrintButton } from '@/components/print-button';

/** One assignment as a printable page (the “PDF version”) — for the class's students and its teacher. */
export default async function AssignmentSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember();
  const supabase = await createClient();
  const { data: a } = await supabase.from('assignments')
    .select('id, title, instructions, max_points, due_on, created_at, offering_id, course_offerings(name, class_level, semesters(no, academic_years(ec_year)))')
    .eq('id', id).maybeSingle();
  if (!a) notFound();
  const o = a.course_offerings as unknown as { name: string; class_level: string; semesters: { no: number; academic_years: { ec_year: number } } } | null;
  const [{ data: sc }, { data: isTeacher }] = await Promise.all([
    supabase.from('assignment_scores').select('score, note').eq('assignment_id', id).eq('member_id', me.memberId).maybeSingle(),
    supabase.rpc('is_teacher_of', { p_offering: a.offering_id }),
  ]);
  const max = Number(a.max_points);

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Link className="back-pill" href={isTeacher ? `/student/teach/${a.offering_id}?v=asg&a=${a.id}` : '/student'}>← ተመለስ</Link>
        <PrintButton />
      </div>
      <article className="doc-sheet asg-sheet">
        <DocHeader title="አሳይመንት" code={a.title} />
        <div className="exam-print-meta">
          {o && <span>ኮርስ፦ <b>{o.name}</b></span>}
          {o && <span>ክፍል፦ <b>{classLabel(o.class_level)}</b></span>}
          {o && <span>ሴሚስተር፦ <b>{semesterLabel(o.semesters.no)} · {o.semesters.academic_years.ec_year} ዓ.ም</b></span>}
          <span>ነጥብ፦ <b>{max}</b></span>
          <span>የተሰጠበት፦ <b>{formatEc(a.created_at.slice(0, 10))}</b></span>
          {a.due_on && <span>ማስረከቢያ፦ <b>{formatEc(a.due_on, { weekday: true })}</b></span>}
        </div>
        {!isTeacher && (
          <div className="exam-print-name">
            <span>ስም፦ <b>{me.fullName}</b></span><span>መለያ ቁ. <b>{me.regNo}</b></span>
            <span>ውጤት፦ <b>{sc?.score != null ? Number(sc.score) : '____'}</b> / {max}</span>
          </div>
        )}
        <h2 className="asg-title serif">{a.title}</h2>
        {a.instructions ? <div className="asg-text">{a.instructions}</div> : <p className="muted">መመሪያ አልተጻፈም — መምህሩን ይጠይቁ።</p>}
        {!isTeacher && sc?.note && <p className="small"><b>የመምህሩ አስተያየት፦</b> {sc.note}</p>}
      </article>
    </>
  );
}
