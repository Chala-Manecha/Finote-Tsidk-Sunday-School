import { formatEc } from './ethiopian-calendar';

export const EXAM_COMPONENTS = { quiz: 'ፈተና (Quiz)', mid: 'የአጋማሽ ፈተና', final: 'ዋና ፈተና' } as const;
export type ExamComponent = keyof typeof EXAM_COMPONENTS;
/** the semester weight column each exam fills in the mark sheet */
export const COMPONENT_WEIGHT: Record<ExamComponent, 'w_quiz' | 'w_mid' | 'w_final'> = { quiz: 'w_quiz', mid: 'w_mid', final: 'w_final' };

export const QUESTION_KINDS = { choice: 'ምርጫ', tf: 'እውነት / ሐሰት', blank: 'ባዶ ቦታ ሙላ', match: 'አዛምድ' } as const;
export type QuestionKind = keyof typeof QUESTION_KINDS;

export const EXAM_STATUS = { draft: 'ረቂቅ', submitted: 'ለማጽደቅ ተልኳል', approved: 'ጸድቋል', rejected: 'ተመልሷል' } as const;
export type ExamStatus = keyof typeof EXAM_STATUS;
export const EXAM_STATUS_PILL: Record<ExamStatus, string> = { draft: 'pending', submitted: 'half', approved: 'present', rejected: 'absent' };

export type Exam = {
  id: string; offering_id: string; component: ExamComponent; title: string; instructions: string | null;
  duration_min: number; opens_at: string; closes_at: string; status: ExamStatus; review_note: string | null;
  pushed_at: string | null; submitted_at: string | null; approved_at: string | null;
};
export const EXAM_COLS = 'id, offering_id, component, title, instructions, duration_min, opens_at, closes_at, status, review_note, pushed_at, submitted_at, approved_at';

export type Question = {
  id: string; exam_id: string; sort: number; kind: QuestionKind; prompt: string; points: number;
  options: string[] | { left: string[]; right: string[] }; answer: number | boolean | string[] | number[];
};
export const QUESTION_COLS = 'id, exam_id, sort, kind, prompt, points, options, answer';

/** Addis Ababa wall-clock (UTC+3, no daylight saving) → timestamptz text. */
export const addisToTs = (dateIso: string, time: string) => `${dateIso}T${time}:00+03:00`;

/** A timestamp shown in Ethiopian date + Addis time. */
export function fmtAddis(ts: string, opts: { weekday?: boolean } = {}) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return `${formatEc(`${p.year}-${p.month}-${p.day}`, opts)} · ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
/** Split a timestamp into Addis date (ISO) + HH:MM for the edit form. */
export function addisParts(ts: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

export function examWindow(e: Pick<Exam, 'opens_at' | 'closes_at'>, now = Date.now()) {
  const o = Date.parse(e.opens_at), c = Date.parse(e.closes_at);
  return now < o ? 'upcoming' : now >= c ? 'closed' : 'open';
}

export const LETTERS = 'ABCDEFGHIJ';
export const totalPoints = (qs: { points: number | string }[]) => Math.round(qs.reduce((t, q) => t + Number(q.points), 0) * 100) / 100;

/** The correct answer as text (for the printed key and the teacher's review). */
export function answerText(q: Pick<Question, 'kind' | 'options' | 'answer'>) {
  if (q.kind === 'choice') { const i = Number(q.answer); return `${LETTERS[i]}. ${(q.options as string[])[i] ?? ''}`; }
  if (q.kind === 'tf') return q.answer === true ? 'እውነት' : 'ሐሰት';
  if (q.kind === 'blank') return (q.answer as string[]).join(' / ');
  const o = q.options as { left: string[]; right: string[] };
  return (q.answer as number[]).map((r, i) => `${i + 1} → ${o.right[r] ?? '?'}`).join('፤ ');
}

/** What the student gave, as text. */
export function givenText(q: Pick<Question, 'kind' | 'options'>, given: unknown) {
  if (given === undefined || given === null || given === '') return '—';
  if (q.kind === 'choice') { const i = Number(given); return `${LETTERS[i]}. ${(q.options as string[])[i] ?? ''}`; }
  if (q.kind === 'tf') return given === true ? 'እውነት' : 'ሐሰት';
  if (q.kind === 'blank') return String(given);
  const o = q.options as { left: string[]; right: string[] };
  return (given as (number | null)[]).map((r, i) => `${i + 1} → ${r === null || r === undefined ? '—' : o.right[r] ?? '?'}`).join('፤ ');
}

/** A row of my_exams() — the signed-in student's exams. */
export type MyExam = {
  id: string; title: string; component: ExamComponent; course: string; class_level: string; opens_at: string; closes_at: string;
  duration_min: number; questions: number; total_points: number; attempt_id: string | null; deadline: string | null;
  submitted_at: string | null; score: number | null; released: boolean;
};
