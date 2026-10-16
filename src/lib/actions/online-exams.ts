'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { requireDept } from '@/lib/auth';
import { COMPONENT_WEIGHT, EXAM_COMPONENTS, QUESTION_KINDS, addisToTs, type ExamComponent, type QuestionKind } from '@/lib/exams';

export type FormState = { error?: string; ok?: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

const ERR: Record<string, string> = {
  exam_locked: 'ፈተናው ለማጽደቅ ተልኳል ወይም ጸድቋል፤ መቀየር አይቻልም።',
  exam_empty: 'ቢያንስ አንድ ጥያቄ ያስፈልጋል።',
  exam_started: 'ተማሪዎች ፈተናውን ጀምረዋል፤ መመለስ አይቻልም።',
  exam_status: 'ይህ እርምጃ አይፈቀድም።',
  exam_not_allowed: 'ይህን ፈተና መውሰድ አይችሉም።',
  exam_not_open: 'ፈተናው ገና አልተከፈተም።',
  exam_closed: 'የፈተናው ጊዜ አልፏል።',
  exam_submitted: 'ፈተናው ቀድሞ ገብቷል።',
  exam_time_up: 'ሰዓቱ አልቋል፤ ፈተናው በራሱ ገብቷል።',
  marks_locked: 'የኮርሱ ውጤት ለማጽደቅ ቀርቧል ወይም ጸድቋል፤ መጀመሪያ ትምህርት ክፍል ይክፈተው።',
  over_weight: 'ከተፈቀደው ነጥብ በላይ ውጤት አለ።',
};
const explain = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? (m.includes('row-level') ? 'ፈቃድ የለዎትም።' : m);
const teachPath = (offeringId: string, examId?: string) => `/student/teach/${offeringId}/exams${examId ? `/${examId}` : ''}`;

// ===================== teacher: the exam =====================
export async function saveExam(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const id = text(fd, 'id');
  const offering_id = text(fd, 'offering_id');
  const component = text(fd, 'component') as ExamComponent;
  const title = text(fd, 'title');
  const duration = Number(text(fd, 'duration_min'));
  const [od, ot, cd, ct] = ['open_date', 'open_time', 'close_date', 'close_time'].map((k) => text(fd, k));
  if (!UUID_RE.test(offering_id)) return { error: 'ኮርሱ አልተገኘም።' };
  if (!(component in EXAM_COMPONENTS)) return { error: 'የፈተናውን አይነት ይምረጡ።' };
  if (title.length < 2) return { error: 'የፈተናውን ርዕስ ያስገቡ።' };
  if (!Number.isInteger(duration) || duration < 1 || duration > 300) return { error: 'የፈተናው ጊዜ ከ1 እስከ 300 ደቂቃ መሆን አለበት።' };
  if (!DATE_RE.test(od) || !TIME_RE.test(ot) || !DATE_RE.test(cd) || !TIME_RE.test(ct)) return { error: 'የመክፈቻና የመዝጊያ ቀንና ሰዓት ያስገቡ።' };
  const opens_at = addisToTs(od, ot), closes_at = addisToTs(cd, ct);
  if (Date.parse(closes_at) <= Date.parse(opens_at)) return { error: 'መዝጊያው ከመክፈቻው በኋላ መሆን አለበት።' };
  if (Date.parse(closes_at) - Date.parse(opens_at) < duration * 60000) return { error: 'ከመክፈቻ እስከ መዝጊያ ያለው ጊዜ ከፈተናው ርዝመት ማነስ የለበትም።' };
  const row = { offering_id, component, title, instructions: text(fd, 'instructions').slice(0, 2000) || null, duration_min: duration, opens_at, closes_at };
  const supabase = await createClient();
  if (id) {
    const { error, count } = await supabase.from('online_exams').update(row, { count: 'exact' }).eq('id', id);
    if (error) return { error: explain(error.message) };
    if (!count) return { error: 'ፈቃድ የለዎትም።' };
    revalidatePath(teachPath(offering_id, id));
    return { ok: 'ተቀምጧል።' };
  }
  const { data, error } = await supabase.from('online_exams').insert(row).select('id').single();
  if (error || !data) return { error: explain(error?.message ?? 'ፈቃድ የለዎትም።') };
  redirect(teachPath(offering_id, data.id));
}

export async function deleteExam(id: string, offeringId: string) {
  await requireMember();
  const supabase = await createClient();
  const { error, count } = await supabase.from('online_exams').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ማጥፋት አልተቻለም (ተማሪዎች ጀምረውት ሊሆን ይችላል)።' };
  redirect(teachPath(offeringId));
}

/** Teacher sends the exam to ትምህርት ክፍል (or takes it back while still waiting). */
export async function setExamStatus(id: string, offeringId: string, status: 'submitted' | 'draft') {
  await requireMember();
  const supabase = await createClient();
  const { error, count } = await supabase.from('online_exams').update({ status }, { count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath(teachPath(offeringId, id));
}

// ===================== teacher: questions =====================
function readQuestion(fd: FormData): { error: string } | { kind: QuestionKind; prompt: string; points: number; options: unknown; answer: unknown } {
  const kind = text(fd, 'kind') as QuestionKind;
  const prompt = text(fd, 'prompt');
  const points = Number(text(fd, 'points'));
  if (!(kind in QUESTION_KINDS)) return { error: 'የጥያቄውን አይነት ይምረጡ።' };
  if (!prompt) return { error: 'ጥያቄውን ይጻፉ።' };
  if (!Number.isFinite(points) || points <= 0 || points > 100) return { error: 'ነጥቡ ከ0 በላይ መሆን አለበት።' };
  let options: unknown, answer: unknown;
  try { options = JSON.parse(text(fd, 'options_json') || '[]'); answer = JSON.parse(text(fd, 'answer_json') || 'null'); } catch { return { error: 'መረጃው አልተነበበም።' }; }
  const str = (v: unknown) => String(v ?? '').trim().slice(0, 500);
  if (kind === 'choice') {
    const opts = (Array.isArray(options) ? options : []).map(str);
    if (opts.length < 2 || opts.length > 8 || opts.some((o) => !o)) return { error: 'ከ2 እስከ 8 ምርጫዎች ያስገቡ (ባዶ ምርጫ አይፈቀድም)።' };
    const a = Number(answer);
    if (!Number.isInteger(a) || a < 0 || a >= opts.length) return { error: 'ትክክለኛውን ምርጫ ይምረጡ።' };
    return { kind, prompt, points, options: opts, answer: a };
  }
  if (kind === 'tf') {
    if (typeof answer !== 'boolean') return { error: 'እውነት ወይም ሐሰት ይምረጡ።' };
    return { kind, prompt, points, options: [], answer };
  }
  if (kind === 'blank') {
    const acc = (Array.isArray(answer) ? answer : []).map(str).filter(Boolean);
    if (acc.length === 0) return { error: 'ቢያንስ አንድ ትክክለኛ መልስ ያስገቡ።' };
    return { kind, prompt, points, options: [], answer: acc };
  }
  const o = (options ?? {}) as { left?: unknown[]; right?: unknown[] };
  const left = (o.left ?? []).map(str), right = (o.right ?? []).map(str);
  if (left.length < 2 || left.length > 10 || left.length !== right.length || [...left, ...right].some((x) => !x)) {
    return { error: 'ከ2 እስከ 10 ሙሉ ጥንዶች ያስገቡ።' };
  }
  return { kind, prompt, points, options: { left, right }, answer: left.map((_, i) => i) };
}

export async function saveQuestion(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const id = text(fd, 'id');
  const exam_id = text(fd, 'exam_id');
  const offeringId = text(fd, 'offering_id');
  if (!UUID_RE.test(exam_id)) return { error: 'ፈተናው አልተገኘም።' };
  const q = readQuestion(fd);
  if ('error' in q) return q;
  const supabase = await createClient();
  if (id) {
    const { error, count } = await supabase.from('exam_questions').update(q, { count: 'exact' }).eq('id', id);
    if (error) return { error: explain(error.message) };
    if (!count) return { error: 'ፈተናው ተቆልፏል ወይም ፈቃድ የለዎትም።' };
  } else {
    const { data: last } = await supabase.from('exam_questions').select('sort').eq('exam_id', exam_id).order('sort', { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from('exam_questions').insert({ ...q, exam_id, sort: (last?.sort ?? 0) + 1 });
    if (error) return { error: explain(error.message) };
  }
  revalidatePath(teachPath(offeringId, exam_id));
  return { ok: id ? 'ጥያቄው ተቀይሯል።' : 'ጥያቄ ተጨምሯል።' };
}

export async function deleteQuestion(id: string, examId: string, offeringId: string) {
  await requireMember();
  const supabase = await createClient();
  const { error, count } = await supabase.from('exam_questions').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈተናው ተቆልፏል።' };
  revalidatePath(teachPath(offeringId, examId));
}

export async function moveQuestion(id: string, examId: string, offeringId: string, dir: -1 | 1) {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from('exam_questions').select('id, sort').eq('exam_id', examId).order('sort').order('created_at');
  const list = data ?? [];
  const i = list.findIndex((q) => q.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, q] of list.entries()) {
    if (q.sort !== k + 1) {
      const { error } = await supabase.from('exam_questions').update({ sort: k + 1 }).eq('id', q.id);
      if (error) return { error: explain(error.message) };
    }
  }
  revalidatePath(teachPath(offeringId, examId));
}

// ===================== teacher: marking =====================
/** Correct the points of one student's paper (blank = keep the automatic mark). */
export async function saveManualPoints(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const attempt = text(fd, 'attempt_id');
  const examId = text(fd, 'exam_id'), offeringId = text(fd, 'offering_id');
  if (!UUID_RE.test(attempt)) return { error: 'ወረቀቱ አልተገኘም።' };
  const manual: Record<string, number> = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith('pts_')) continue;
    const raw = String(v).trim();
    if (raw === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return { error: `ትክክል ያልሆነ ቁጥር፦ ${raw}` };
    manual[k.slice(4)] = Math.round(n * 100) / 100;
  }
  const supabase = await createClient();
  const { error, count } = await supabase.from('exam_attempts').update({ manual_points: manual }, { count: 'exact' }).eq('id', attempt);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath(teachPath(offeringId, examId));
  return { ok: 'ማስተካከያው ተቀምጧል።' };
}

/**
 * Send the result to the course mark sheet: score / total × the component's weight.
 * Several quizzes (or mids) of the same course → each student's average over the ones they sat.
 */
export async function pushResults(examId: string) {
  await requireMember();
  const supabase = await createClient();
  const { data: exam } = await supabase.from('online_exams')
    .select('id, offering_id, component, status, course_offerings(semesters(w_quiz, w_mid, w_final))').eq('id', examId).maybeSingle();
  if (!exam || exam.status !== 'approved') return { error: 'ፈተናው አልጸደቀም።' };
  await supabase.rpc('close_expired_attempts', { p_exam: examId });
  const sem = (exam.course_offerings as unknown as { semesters: Record<string, number> }).semesters;
  const weight = sem[COMPONENT_WEIGHT[exam.component as ExamComponent]];
  const { data: same } = await supabase.from('online_exams').select('id, pushed_at, exam_questions(points)')
    .eq('offering_id', exam.offering_id).eq('component', exam.component).eq('status', 'approved');
  const exams = (same ?? []).filter((e) => e.id === examId || e.pushed_at);
  const totals = new Map(exams.map((e) => [e.id, (e.exam_questions as { points: number }[]).reduce((t, q) => t + Number(q.points), 0)]));
  const { data: attempts } = await supabase.from('exam_attempts').select('exam_id, member_id, score, submitted_at')
    .in('exam_id', exams.map((e) => e.id)).not('submitted_at', 'is', null);
  const per = new Map<string, number[]>();
  for (const a of attempts ?? []) {
    const total = totals.get(a.exam_id) ?? 0;
    if (!total || a.score === null) continue;
    per.set(a.member_id, [...(per.get(a.member_id) ?? []), Number(a.score) / total]);
  }
  const rows = [...per].map(([member_id, xs]) => ({
    offering_id: exam.offering_id, member_id,
    [exam.component]: Math.round((xs.reduce((t, x) => t + x, 0) / xs.length) * weight * 100) / 100,
  }));
  if (rows.length) {
    const { error } = await supabase.from('marks').upsert(rows, { onConflict: 'offering_id,member_id' });
    if (error) return { error: explain(error.message) };
  }
  const { error } = await supabase.from('online_exams').update({ pushed_at: new Date().toISOString() }).eq('id', examId);
  if (error) return { error: explain(error.message) };
  revalidatePath(`/student/teach/${exam.offering_id}`, 'layout');
}

// ===================== ትምህርት ክፍል: approval =====================
export async function approveExams(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const ids = fd.getAll('ids').map(String).filter((x) => UUID_RE.test(x));
  if (!ids.length) return { error: 'መጀመሪያ ፈተናዎችን ይምረጡ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('online_exams').update({ status: 'approved' }, { count: 'exact' }).in('id', ids).eq('status', 'submitted');
  if (error) return { error: explain(error.message) };
  revalidatePath('/staff/education', 'layout');
  return { ok: `${count ?? 0} ፈተናዎች ጸድቀዋል።` };
}

export async function decideExam(id: string, status: 'approved' | 'draft') {
  await requireDept('education');
  const supabase = await createClient();
  const { error, count } = await supabase.from('online_exams').update({ status }, { count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath('/staff/education', 'layout');
}

export async function rejectExam(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const id = text(fd, 'id');
  const note = text(fd, 'review_note').slice(0, 500);
  if (!note) return { error: 'ለመምህሩ ምክንያቱን ይጻፉ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('online_exams').update({ status: 'rejected', review_note: note }, { count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath('/staff/education', 'layout');
  return { ok: 'ለመምህሩ ተመልሷል።' };
}

// ===================== student =====================
export type Paper = {
  attempt: string; title: string; component: ExamComponent; course: string; instructions: string | null; duration_min: number;
  deadline: string; now: string; submitted: boolean; answers: Record<string, unknown>; flags: string[];
  questions: { id: string; kind: QuestionKind; prompt: string; points: number; options: { i: number; t: string }[] | { left: string[]; right: { i: number; t: string }[] } }[];
};

export async function startExam(examId: string): Promise<{ error?: string; paper?: Paper }> {
  await requireMember();
  const supabase = await createClient();
  const { data: attempt, error } = await supabase.rpc('start_exam', { p_exam: examId });
  if (error || !attempt) return { error: explain(error?.message ?? 'exam_not_allowed') };
  const { data: paper, error: e2 } = await supabase.rpc('exam_paper', { p_attempt: attempt });
  if (e2 || !paper) return { error: explain(e2?.message ?? 'exam_not_allowed') };
  return { paper: paper as Paper };
}

export async function saveAnswers(attempt: string, answers: Record<string, unknown>, flags: string[], left: number): Promise<{ error?: string; timeUp?: boolean }> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_exam_answers', { p_attempt: attempt, p_answers: answers, p_flags: flags, p_left: left });
  if (error) return { error: explain(error.message), timeUp: error.message.includes('exam_time_up') || error.message.includes('exam_submitted') };
  return {};
}

export async function finishExam(attempt: string, answers: Record<string, unknown>, flags: string[], left: number, auto: boolean): Promise<{ error?: string }> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_exam', { p_attempt: attempt, p_answers: answers, p_flags: flags, p_left: left, p_auto: auto });
  if (error) return { error: explain(error.message) };
  revalidatePath('/student');
  return {};
}
