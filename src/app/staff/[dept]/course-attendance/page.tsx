import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { semesterLabel } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { PrintButton } from '@/components/print-button';
import { StudentAttendance, TeacherAttendance } from '@/components/course-attendance-views';

/** ኦዲት's view of course attendance. ትምህርት ክፍል has it inside ክፍሎችና ተማሪዎች / ኮርሶችና መምህራን. */
export default async function CourseAttendance({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ v?: string; s?: string; c?: string; d?: string; all?: string }>;
}) {
  const { dept } = await params;
  const sp = await searchParams;
  if (dept === 'education') redirect(sp.v === 'teachers' ? '/staff/education/courses?v=teachers' : '/staff/education/classes?v=attendance');
  if (dept !== 'audit') notFound();
  const view = sp.v === 'teachers' ? 'teachers' : 'students';
  const supabase = await createClient();
  const { years, semesters, semester, year } = await loadTerms(supabase, sp.s);
  if (!semester || !year) return <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>;
  const base = `/staff/${dept}/course-attendance`;

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የኮርስ ክትትል — {year.ec_year} ዓ.ም · {semesterLabel(semester.no)}</h2>
        <PrintButton />
      </div>
      <div className="cat-tabs no-print">
        <Link href={`${base}?v=students&s=${semester.id}`} className={view === 'students' ? 'active' : ''}>የተማሪዎች ክትትል</Link>
        <Link href={`${base}?v=teachers&s=${semester.id}`} className={view === 'teachers' ? 'active' : ''}>የመምህራን ክትትል</Link>
      </div>
      {view === 'students'
        ? <StudentAttendance supabase={supabase} base={base} years={years} semesters={semesters} semester={semester} cls={sp.c} />
        : <TeacherAttendance supabase={supabase} base={base} semester={semester} date={sp.d} all={sp.all === '1'} canEdit={false} view="teachers" />}
    </>
  );
}
