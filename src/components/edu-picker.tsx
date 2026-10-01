import { CLASS_LEVELS, classLabel, semesterLabel, type AcademicYear, type Semester } from '@/lib/education';

/** GET form to choose semester (and optionally class). */
export function EduPicker({ action, years, semesters, semesterId, classLevel, withClass = true }: {
  action: string; years: AcademicYear[]; semesters: Semester[]; semesterId?: string; classLevel?: string; withClass?: boolean;
}) {
  return (
    <form className="toolbar no-print" action={action}>
      <div className="field">
        <label htmlFor="s">ወሰነ ትምህርት</label>
        <select id="s" name="s" defaultValue={semesterId}>
          {years.map((y) => semesters.filter((s) => s.year_id === y.id).map((s) => (
            <option key={s.id} value={s.id}>{y.ec_year} ዓ.ም · {semesterLabel(s.no)}{s.is_active ? ' (ንቁ)' : ''}</option>
          )))}
        </select>
      </div>
      {withClass && (
        <div className="field">
          <label htmlFor="c">ክፍል</label>
          <select id="c" name="c" defaultValue={classLevel ?? ''}>
            <option value="">ሁሉም</option>
            {CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
          </select>
        </div>
      )}
      <button className="btn sm">አሳይ</button>
    </form>
  );
}
