import Link from 'next/link';
import { semesterLabel, type AcademicYear, type Semester } from '@/lib/education';

/** የተማሪ ውጤት: switch between each semester's results and the year summary (with the printable cards). */
export function ResultsSwitch({ dept, year, semesters, current, cls }: {
  dept: string; year: Pick<AcademicYear, 'id' | 'ec_year'>; semesters: Semester[]; current: string; cls?: string | null;
}) {
  const c = cls ? `&c=${cls}` : '';
  const sems = semesters.filter((s) => s.year_id === year.id).sort((a, b) => a.no - b.no);
  return (
    <div className="seg no-print">
      {sems.map((s) => (
        <Link key={s.id} className={current === s.id ? 'on' : ''} href={`/staff/${dept}/results?s=${s.id}${c}`}>{semesterLabel(s.no)}</Link>
      ))}
      <Link className={current === 'year' ? 'on' : ''} href={`/staff/${dept}/year-end?y=${year.id}${c}`}>📊 የዓመት ማጠቃለያና ካርድ</Link>
    </div>
  );
}
