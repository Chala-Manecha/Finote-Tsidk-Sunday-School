// Education labels and grading helpers shared by staff pages, the student area and transcripts.

export const CLASS_LEVELS = ['kids', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];
export const isClassLevel = (v: string): v is ClassLevel => (CLASS_LEVELS as readonly string[]).includes(v);
export const classLabel = (c: string | null | undefined) =>
  !c ? 'ያልተመደበ' : c === 'kids' ? 'ሕፃናት ክፍል' : `${c}ኛ ክፍል`;

export const COMPONENTS = [
  { key: 'quiz', label: 'ፈተና (Quiz)', weight: 'w_quiz' },
  { key: 'notebook', label: 'ደብተር ማርክ', weight: 'w_notebook' },
  { key: 'participation', label: 'ተሣትፎ', weight: 'w_participation' },
  { key: 'mid', label: 'አጋማሽ ፈተና', weight: 'w_mid' },
  { key: 'final', label: 'ዋና ፈተና', weight: 'w_final' },
] as const;
export type ComponentKey = (typeof COMPONENTS)[number]['key'];

export type Semester = {
  id: string; year_id: string; no: number; starts_on: string | null; ends_on: string | null;
  w_quiz: number; w_notebook: number; w_participation: number; w_mid: number; w_final: number;
  pass_mark: number; is_active: boolean;
  mid_exam_on: string | null; final_exam_on: string | null; min_attendance: number; min_attendance_distance: number;
};
export type AcademicYear = { id: string; ec_year: number; is_active: boolean; promote_min_average: number; max_failed_courses: number };
export const DECISION = { promoted: 'ተዛውረዋል', repeat: 'ይደግማሉ' } as const;
export type Decision = keyof typeof DECISION;
export type YearRow = {
  member_id: string; full_name: string; reg_no: string; sem1_average: number | null; sem2_average: number | null;
  year_average: number | null; failed_courses: number | null; rank: number | null; class_size: number;
  auto_decision: Decision; decision: Decision | null; remark: string | null; ready: boolean;
};
export const semesterLabel = (no: number) => (no === 1 ? '1ኛ ወሰነ ትምህርት' : '2ኛ ወሰነ ትምህርት');

/** ደረጃ for a total out of 100. */
export function gradeOf(total: number, pass: number): { label: string; passed: boolean } {
  if (total < pass) return { label: 'አላለፈም', passed: false };
  if (total >= 90) return { label: 'እጅግ በጣም ጥሩ', passed: true };
  if (total >= 80) return { label: 'በጣም ጥሩ', passed: true };
  if (total >= 70) return { label: 'ጥሩ', passed: true };
  return { label: 'በቂ', passed: true };
}

export const CONDUCT = { A: 'እጅግ በጣም ጥሩ', B: 'በጣም ጥሩ', C: 'ጥሩ', D: 'መሻሻል ያስፈልገዋል' } as const;
export type Conduct = keyof typeof CONDUCT;

export const OFFERING_STATUS = { draft: 'ውጤት በመሞላት ላይ', submitted: 'ለማጽደቅ ቀርቧል', approved: 'ጸድቋል' } as const;
export type OfferingStatus = keyof typeof OFFERING_STATUS;

export type ResultRow = {
  member_id: string; full_name: string; reg_no: string; offering_id: string; course: string;
  quiz: number | null; notebook: number | null; participation: number | null; mid: number | null; final: number | null;
  total: number; attended: number; sessions: number; status: OfferingStatus; makeup?: boolean;
  average: number; rank: number; class_size: number; ready: boolean;
};

export const READY_MESSAGE = 'ትራንስክሪፕትዎ ዝግጁ ነው። ከትምህርት ክፍል ቢሮ በመምጣት መውሰድ ይችላሉ።';
export const THANKSGIVING = 'አስጀምሮ ያስፈጸመን እግዚአብሔር ይመስገን።';
export const MEMBER_EMAIL_DOMAIN = 'member.finote-tsidk.app';
