import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDept, canAccess } from '@/lib/auth';
import { type ResultRow, type Semester, type YearRow } from '@/lib/education';
import { ReportCardSheets, type CardLine } from '@/components/report-card';
import { PrintButton } from '@/components/print-button';


/** የዓመት ውጤት ካርድ — 2 A4 pages: (1) school, student, pass/fail, signatures, thanks; (2) courses with both semesters, average and rank. */
export default async function ReportCard({ params }: { params: Promise<{ yearId: string; memberId: string }> }) {
  const { yearId, memberId } = await params;
  const staff = await requireDept('education', 'audit');
  const back = canAccess(staff, 'education') ? 'education' : 'audit';
  const supabase = await createClient();
  const [{ data: yr }, { data: enr }, { data: m }, { data: sems }] = await Promise.all([
    supabase.from('academic_years').select('id, ec_year, promote_min_average').eq('id', yearId).maybeSingle(),
    supabase.from('enrollments').select('class_level, study_mode').eq('year_id', yearId).eq('member_id', memberId).maybeSingle(),
    supabase.from('members').select('full_name, reg_no, sex, photo_path').eq('id', memberId).maybeSingle(),
    supabase.from('semesters').select('*').eq('year_id', yearId).order('no'),
  ]);
  if (!yr || !m || !enr?.class_level) notFound();
  const cls = enr.class_level;
  const semesters = (sems ?? []) as Semester[];
  const { data: yrows } = await supabase.rpc('year_results', { p_year: yearId, p_class: cls });
  const y = ((yrows ?? []) as YearRow[]).find((r) => r.member_id === memberId);
  const perSem = await Promise.all(semesters.map(async (s) => {
    const { data } = await supabase.rpc('semester_results', { p_semester: s.id, p_class: cls });
    return { s, rows: ((data ?? []) as ResultRow[]).filter((r) => r.member_id === memberId) };
  }));

  // Teachers of every offering this student took.
  const offerings = perSem.flatMap((p) => p.rows.map((r) => r.offering_id));
  const { data: teach } = offerings.length
    ? await supabase.from('offering_teachers').select('offering_id, members(full_name)').in('offering_id', offerings)
    : { data: [] };
  const teacherOf = (o: string) => ((teach ?? []) as unknown as { offering_id: string; members: { full_name: string } | null }[])
    .filter((x) => x.offering_id === o).map((x) => x.members?.full_name).filter((n): n is string => !!n);

  // One line per course name, with the 1st and 2nd semester totals side by side.
  const lines = new Map<string, CardLine>();
  for (const { s, rows } of perSem) {
    for (const r of rows) {
      const l = lines.get(r.course) ?? { course: r.course, teachers: [], s1: null, s2: null };
      if (s.no === 1) l.s1 = Number(r.total); else l.s2 = Number(r.total);
      for (const t of teacherOf(r.offering_id)) if (!l.teachers.includes(t)) l.teachers.push(t);
      lines.set(r.course, l);
    }
  }
  const table = [...lines.values()];
  const sem = (no: number) => perSem.find((p) => p.s.no === no)?.rows[0];
  const s1 = sem(1);
  const s2 = sem(2);
  const passMark = Number(semesters[0]?.pass_mark ?? 50);
  const decision = y?.decision ?? y?.auto_decision ?? null;
  const photo = m.photo_path ? (await supabase.storage.from('member-docs').createSignedUrl(m.photo_path, 600)).data?.signedUrl : null;
  const draft = !y?.ready;

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href={`/staff/${back}/year-end?y=${yearId}&c=${cls}`}>← ተመለስ</Link>
        <PrintButton />
      </div>
      {draft && <p className="alert no-print">ሁሉም ኮርሶች ገና አልጸደቁም — ካርዱ “ረቂቅ” ሆኖ ይታተማል።</p>}

      <ReportCardSheets data={{
        draft, ecYear: yr.ec_year, promoteMin: yr.promote_min_average, passMark, decision, photo: photo ?? null,
        student: { fullName: m.full_name, regNo: m.reg_no, sex: m.sex, classLevel: cls, studyMode: enr.study_mode ?? 'regular' },
        lines: table, s1: s1 ? { average: s1.average, rank: s1.rank, size: s1.class_size } : null,
        s2: s2 ? { average: s2.average, rank: s2.rank, size: s2.class_size } : null,
        year: y ? { average: y.year_average, rank: y.rank, size: y.class_size, remark: y.remark } : null,
      }} />
    </>
  );
}
