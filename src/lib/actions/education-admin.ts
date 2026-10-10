'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isClassLevel } from '@/lib/education';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const refresh = () => { revalidatePath('/staff', 'layout'); revalidatePath('/student', 'layout'); };
const ERR: Record<string, string> = {
  teacher_in_own_class: 'መምህሩ በዚሁ ክፍል ተማሪ ነው፤ የራሱን ክፍል ማስተማር አይችልም።',
  unlock_reason_required: 'ለመክፈት ምክንያት ያስፈልጋል።',
  finals_missing: 'ለሁሉም ተማሪዎች የዋና ፈተና ውጤት አልገባም።',
  semesters_check: 'የነጥቦቹ ድምር 100 መሆን አለበት።',
  duplicate: 'ቀደም ብሎ ተመዝግቧል።',
};
const explain = (m: string) =>
  Object.entries(ERR).find(([k]) => m.includes(k))?.[1]
  ?? (m.includes('unique') ? 'ቀደም ብሎ ተመዝግቧል።' : m.includes('row-level') || m.includes('only') ? 'ፈቃድ የለዎትም።' : m);

// ---------- years and semesters ----------

export async function createYear(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const ec_year = Number(text(fd, 'ec_year'));
  if (!Number.isInteger(ec_year) || ec_year < 2000 || ec_year > 2100) return { error: 'ዓ.ም ያስገቡ (ለምሳሌ 2019)።' };
  const supabase = await createClient();
  const { data: active } = await supabase.from('academic_years').select('id').eq('is_active', true).maybeSingle();
  const { data: y, error } = await supabase.from('academic_years').insert({ ec_year, is_active: !active }).select('id').single();
  if (error) return { error: explain(error.message) };
  await supabase.from('semesters').insert([{ year_id: y.id, no: 1 }, { year_id: y.id, no: 2 }]);
  refresh();
  return { ok: `${ec_year} ዓ.ም ተከፍቷል (2 ሴሚስተር)።` };
}

export async function activateYear(id: string) {
  await requireDept('education');
  const supabase = await createClient();
  await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true).neq('id', id);
  const { error } = await supabase.from('academic_years').update({ is_active: true }).eq('id', id);
  if (error) return { error: explain(error.message) };
  refresh();
}

export async function saveSemester(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const id = text(fd, 'id');
  const n = (k: string) => Number(text(fd, k));
  const row = {
    w_quiz: n('w_quiz'), w_notebook: n('w_notebook'), w_participation: n('w_participation'),
    w_mid: n('w_mid'), w_final: n('w_final'), pass_mark: n('pass_mark'),
    starts_on: DATE_RE.test(text(fd, 'starts_on')) ? text(fd, 'starts_on') : null,
    ends_on: DATE_RE.test(text(fd, 'ends_on')) ? text(fd, 'ends_on') : null,
    mid_exam_on: DATE_RE.test(text(fd, 'mid_exam_on')) ? text(fd, 'mid_exam_on') : null,
    final_exam_on: DATE_RE.test(text(fd, 'final_exam_on')) ? text(fd, 'final_exam_on') : null,
    min_attendance: n('min_attendance'),
    min_attendance_distance: n('min_attendance_distance'),
  };
  const sum = row.w_quiz + row.w_notebook + row.w_participation + row.w_mid + row.w_final;
  if (Object.values(row).some((v) => typeof v === 'number' && (!Number.isInteger(v) || v < 0))) return { error: 'ሙሉ ቁጥሮች ያስገቡ።' };
  if (sum !== 100) return { error: `የነጥቦቹ ድምር 100 መሆን አለበት (አሁን ${sum})።` };
  if (row.pass_mark > 100 || row.min_attendance > 100 || row.min_attendance_distance > 100) return { error: 'ከ100 መብለጥ የለበትም።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('semesters').update(row, { count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

export async function activateSemester(id: string) {
  await requireDept('education');
  const supabase = await createClient();
  await supabase.from('semesters').update({ is_active: false }).eq('is_active', true).neq('id', id);
  const { error } = await supabase.from('semesters').update({ is_active: true }).eq('id', id);
  if (error) return { error: explain(error.message) };
  refresh();
}

// ---------- enrollments ----------

/** Every registered member is a course student: enroll all active members not yet in this year. */
export async function enrollAllMembers(yearId: string) {
  await requireDept('education');
  const supabase = await createClient();
  const [{ data: members }, { data: existing }] = await Promise.all([
    supabase.from('members').select('id').eq('is_active', true),
    supabase.from('enrollments').select('member_id').eq('year_id', yearId),
  ]);
  const have = new Set((existing ?? []).map((e) => e.member_id));
  const rows = (members ?? []).filter((m) => !have.has(m.id)).map((m) => ({ year_id: yearId, member_id: m.id }));
  if (rows.length) {
    const { error } = await supabase.from('enrollments').insert(rows);
    if (error) return { error: explain(error.message) };
  }
  refresh();
}

const NEXT_CLASS: Record<string, string | null> = {
  kids: '1', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '7', 7: '8', 8: '9', 9: '10', 10: '11', 11: '12', 12: null,
};

/** Bulk: put the ticked students into one class (and optionally change መደበኛ/የርቀት). */
export async function bulkAssignClass(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const ids = fd.getAll('ids').map(String).filter((x) => UUID_RE.test(x));
  const cls = text(fd, 'class_level');
  const mode = text(fd, 'study_mode');
  if (ids.length === 0) return { error: 'ቢያንስ አንድ ተማሪ ይምረጡ።' };
  if (cls !== 'none' && cls !== 'keep' && !isClassLevel(cls)) return { error: 'ክፍል ይምረጡ።' };
  if (cls === 'keep' && mode === 'keep') return { error: 'ክፍል ወይም መርሐ ግብር ይምረጡ።' };
  const row: Record<string, unknown> = {};
  if (cls !== 'keep') row.class_level = cls === 'none' ? null : cls;
  if (mode === 'regular' || mode === 'distance') row.study_mode = mode;
  const supabase = await createClient();
  const { error, count } = await supabase.from('enrollments').update(row, { count: 'exact' }).in('id', ids);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: `${count} ተማሪ(ዎች) ተመድበዋል።` };
}

/**
 * New year: place last year's students by their year-end decision —
 * ተዛውረዋል → next class, ይደግማሉ → same class (12ኛ ያጠናቀቁ are left out). Keeps መደበኛ/የርቀት.
 */
export async function carryOverYear(yearId: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { data: years } = await supabase.from('academic_years').select('id, ec_year').order('ec_year');
  const idx = (years ?? []).findIndex((y) => y.id === yearId);
  const prev = idx > 0 ? years![idx - 1] : null;
  if (!prev) return { error: 'ያለፈው የትምህርት ዘመን አልተገኘም።' };
  const [{ data: before }, { data: now }, { data: active }] = await Promise.all([
    supabase.from('enrollments').select('member_id, class_level, study_mode').eq('year_id', prev.id).not('class_level', 'is', null),
    supabase.from('enrollments').select('id, member_id, class_level').eq('year_id', yearId),
    supabase.from('members').select('id').eq('is_active', true),
  ]);
  const activeIds = new Set((active ?? []).map((m) => m.id));
  const levels = [...new Set((before ?? []).map((e) => e.class_level as string))];
  const decisions = new Map<string, string>();
  for (const lv of levels) {
    const { data } = await supabase.rpc('year_results', { p_year: prev.id, p_class: lv });
    for (const r of (data ?? []) as { member_id: string; decision: string | null; auto_decision: string }[]) {
      decisions.set(r.member_id, r.decision ?? r.auto_decision);
    }
  }
  const current = new Map((now ?? []).map((e) => [e.member_id as string, e]));
  const inserts: { year_id: string; member_id: string; class_level: string; study_mode: string }[] = [];
  const updates = new Map<string, string[]>(); // class → enrollment ids
  let graduated = 0;
  for (const e of before ?? []) {
    if (!activeIds.has(e.member_id)) continue;
    const d = decisions.get(e.member_id);
    if (!d) continue;
    const target = d === 'promoted' ? NEXT_CLASS[e.class_level as string] : (e.class_level as string);
    if (!target) { graduated += 1; continue; }
    const cur = current.get(e.member_id);
    if (!cur) inserts.push({ year_id: yearId, member_id: e.member_id, class_level: target, study_mode: e.study_mode ?? 'regular' });
    else if (!cur.class_level) updates.set(target, [...(updates.get(target) ?? []), cur.id as string]);
  }
  if (inserts.length) {
    const { error } = await supabase.from('enrollments').insert(inserts);
    if (error) return { error: explain(error.message) };
  }
  for (const [cls, ids] of updates) {
    const { error } = await supabase.from('enrollments').update({ class_level: cls }).in('id', ids);
    if (error) return { error: explain(error.message) };
  }
  refresh();
  const placed = inserts.length + [...updates.values()].reduce((t, x) => t + x.length, 0);
  if (!placed) return { error: `የሚመደብ ተማሪ አልተገኘም (የ${prev.ec_year} ዓ.ም ውሳኔ ያላቸው፣ ገና ያልተመደቡ)።${graduated ? ` ${graduated} 12ኛን ያጠናቀቁ።` : ''}` };
}

/** Copy courses (with teachers, days/time and book) from another semester into this one; existing names are skipped. */
export async function copyCourses(fromId: string, toId: string) {
  await requireDept('education');
  if (!UUID_RE.test(fromId) || !UUID_RE.test(toId) || fromId === toId) return { error: 'ሴሚስተር ይምረጡ።' };
  const supabase = await createClient();
  const [{ data: src }, { data: have }, { data: target }] = await Promise.all([
    supabase.from('course_offerings').select('id, class_level, name, days, time_text, book_path, book_name, offering_teachers(member_id)').eq('semester_id', fromId),
    supabase.from('course_offerings').select('class_level, name').eq('semester_id', toId),
    supabase.from('semesters').select('year_id').eq('id', toId).maybeSingle(),
  ]);
  if (!target) return { error: 'ሴሚስተሩ አልተገኘም።' };
  const exists = new Set((have ?? []).map((o) => `${o.class_level}|${o.name}`));
  const todo = ((src ?? []) as unknown as {
    id: string; class_level: string; name: string; days: number[]; time_text: string | null;
    book_path: string | null; book_name: string | null; offering_teachers: { member_id: string }[];
  }[]).filter((o) => !exists.has(`${o.class_level}|${o.name}`));
  if (!todo.length) return { error: 'የሚቀዳ አዲስ ኮርስ የለም።' };
  const { data: made, error } = await supabase.from('course_offerings').insert(todo.map((o) => ({
    semester_id: toId, class_level: o.class_level, name: o.name, days: o.days, time_text: o.time_text,
    book_path: o.book_path, book_name: o.book_name,
  }))).select('id, class_level, name');
  if (error) return { error: explain(error.message) };
  const idOf = new Map((made ?? []).map((m) => [`${m.class_level}|${m.name}`, m.id as string]));
  const teachers = todo.flatMap((o) => o.offering_teachers.map((t) => ({ offering_id: idOf.get(`${o.class_level}|${o.name}`)!, member_id: t.member_id })));
  // A teacher who is now a student of that class is refused by the database — add the rest one by one.
  for (const t of teachers) await supabase.from('offering_teachers').insert(t);
  refresh();
}

/** Semester 2 (or any) takes the weights, pass mark and attendance minimums of another semester. */
export async function copySemesterRules(fromId: string, toId: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { data: f } = await supabase.from('semesters')
    .select('w_quiz, w_notebook, w_participation, w_mid, w_final, pass_mark, min_attendance, min_attendance_distance').eq('id', fromId).maybeSingle();
  if (!f) return { error: 'ሴሚስተሩ አልተገኘም።' };
  const { error, count } = await supabase.from('semesters').update(f, { count: 'exact' }).eq('id', toId);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

// ---------- courses ----------

export async function addCourse(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const semester_id = text(fd, 'semester_id');
  const class_level = text(fd, 'class_level');
  const name = text(fd, 'name');
  if (!UUID_RE.test(semester_id)) return { error: 'ሴሚስተር ይምረጡ።' };
  if (!isClassLevel(class_level)) return { error: 'ክፍል ይምረጡ።' };
  if (name.length < 2) return { error: 'የኮርሱን ስም ያስገቡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('course_offerings').insert({ semester_id, class_level, name });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: 'ኮርሱ ተጨምሯል።' };
}

export async function deleteCourse(id: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { error, count } = await supabase.from('course_offerings').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message.includes('foreign') ? 'ውጤት ያለው ኮርስ መጥፋት አይችልም።' : explain(error.message) };
  if (!count) return { error: 'የጸደቀ ወይም የቀረበ ኮርስ መጥፋት አይችልም።' };
  refresh();
}

export async function approveCourse(id: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { error, count } = await supabase.from('course_offerings').update({ status: 'approved' }, { count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** Return a submitted course, or unlock an approved one — always with a written reason. */
export async function unlockCourse(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const id = text(fd, 'id');
  const reason = text(fd, 'reason');
  if (reason.length < 3) return { error: 'ምክንያቱን ይጻፉ።' };
  const supabase = await createClient();
  const { data: o } = await supabase.from('course_offerings').select('status').eq('id', id).maybeSingle();
  if (!o || o.status === 'draft') return { error: 'ኮርሱ ቀድሞውኑ ክፍት ነው።' };
  const { error: e1 } = await supabase.from('offering_unlocks').insert({ offering_id: id, from_status: o.status, reason });
  if (e1) return { error: explain(e1.message) };
  const { error } = await supabase.from('course_offerings').update({ status: 'draft' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: 'ኮርሱ ለመምህሩ ተከፍቷል።' };
}

// ---------- conduct, transcripts, accounts ----------

export async function saveConduct(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const semester_id = text(fd, 'semester_id');
  const member_id = text(fd, 'member_id');
  const conduct = text(fd, 'conduct');
  if (!['A', 'B', 'C', 'D', ''].includes(conduct)) return { error: 'ጠባይ ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('semester_conduct')
    .upsert({ semester_id, member_id, conduct: conduct || null, remark: text(fd, 'remark') || null }, { onConflict: 'semester_id,member_id' });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: '✓' };
}

export async function openTranscript(semesterId: string, memberId: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('issue_transcript', { p_semester: semesterId, p_member: memberId });
  if (error || !data) return { error: explain(error?.message ?? 'አልተቻለም።') };
  redirect(`/staff/transcripts/${data}`);
}

export async function markTranscriptPrinted(id: string) {
  await requireDept('education');
  const supabase = await createClient();
  await supabase.rpc('mark_transcript_printed', { p_id: id });
  refresh();
}

/** Unlock after 5 wrong PINs. */
export async function unlockAccount(memberId: string) {
  await requireDept('education');
  const admin = createAdminClient();
  await admin.from('member_accounts').update({ locked_at: null, failed_attempts: 0 }).eq('member_id', memberId);
  refresh();
}

/** Forgotten PIN: remove the login so the member registers again with ID + phone. */
export async function resetAccount(memberId: string) {
  await requireDept('education');
  const admin = createAdminClient();
  const { data } = await admin.from('member_accounts').select('user_id').eq('member_id', memberId).maybeSingle();
  if (data?.user_id) await admin.auth.admin.deleteUser(data.user_id);   // cascades to member_accounts
  refresh();
}

/** Year-end promotion rule. */
export async function saveYearRules(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const avg = Number(text(fd, 'promote_min_average'));
  const failed = Number(text(fd, 'max_failed_courses'));
  if (!Number.isInteger(avg) || avg < 0 || avg > 100) return { error: 'አማካይ ከ0 እስከ 100።' };
  if (!Number.isInteger(failed) || failed < 0) return { error: 'ቁጥር ያስገቡ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('academic_years')
    .update({ promote_min_average: avg, max_failed_courses: failed }, { count: 'exact' }).eq('id', text(fd, 'id'));
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: 'ተቀምጧል።' };
}

/** One form per course: teachers (add one / remove ticked), days + time, reference book — saved together. */
export async function saveCourseDetails(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const id = text(fd, 'id');
  if (!UUID_RE.test(id)) return { error: 'ኮርሱ አልተገኘም።' };
  const supabase = await createClient();
  const days = fd.getAll('days').map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const book = text(fd, 'book_path');
  const { data: old } = await supabase.from('course_offerings').select('book_path').eq('id', id).maybeSingle();
  const row = {
    days, time_text: text(fd, 'time_text') || null,
    ...(book.startsWith('books/') ? { book_path: book, book_name: text(fd, 'book_name') || null } : {}),
  };
  const { error, count } = await supabase.from('course_offerings').update(row, { count: 'exact' }).eq('id', id);
  if (error || !count) {
    if (book.startsWith('books/')) await supabase.storage.from('edu-books').remove([book]);
    return { error: explain(error?.message ?? 'ፈቃድ የለዎትም።') };
  }
  if (book.startsWith('books/') && old?.book_path && old.book_path !== book) {
    // A copied course shares its book with the original — only delete the file when nobody uses it.
    const { count: users } = await supabase.from('course_offerings').select('id', { count: 'exact', head: true }).eq('book_path', old.book_path);
    if (!users) await supabase.storage.from('edu-books').remove([old.book_path]);
  }

  const drop = fd.getAll('remove_teacher').map(String).filter((x) => UUID_RE.test(x));
  if (drop.length) {
    const { error: e } = await supabase.from('offering_teachers').delete().eq('offering_id', id).in('member_id', drop);
    if (e) return { error: explain(e.message) };
  }
  const add = text(fd, 'member_id');
  if (UUID_RE.test(add) && !drop.includes(add)) {
    const { error: e } = await supabase.from('offering_teachers').insert({ offering_id: id, member_id: add });
    if (e && !e.message.includes('duplicate') && !e.message.includes('unique')) {
      refresh();
      return { error: explain(e.message) };
    }
  }
  refresh();
  revalidatePath('/course');
  return { ok: 'ተቀምጧል።' };
}

/** ትምህርት ክፍል marks the teachers of each course for one day (empty = not recorded). */
export async function saveTeacherAttendance(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const att_date = text(fd, 'att_date');
  if (!DATE_RE.test(att_date)) return { error: 'ቀን ይምረጡ።' };
  const keys = fd.getAll('key').map(String).filter((k) => /^[0-9a-f-]{36}_[0-9a-f-]{36}$/i.test(k));
  const supabase = await createClient();
  const up: { offering_id: string; member_id: string; att_date: string; status: string; note: string | null }[] = [];
  for (const k of keys) {
    const [offering_id, member_id] = k.split('_');
    const status = text(fd, `s_${k}`);
    if (['present', 'late', 'absent', 'excused'].includes(status)) {
      up.push({ offering_id, member_id, att_date, status, note: text(fd, `n_${k}`) || null });
    } else {
      await supabase.from('teacher_attendance').delete().eq('offering_id', offering_id).eq('member_id', member_id).eq('att_date', att_date);
    }
  }
  if (up.length) {
    const { error } = await supabase.from('teacher_attendance').upsert(up, { onConflict: 'offering_id,member_id,att_date' });
    if (error) return { error: explain(error.message) };
  }
  refresh();
  return { ok: `${up.length} መምህር(ራን) ተመዝግበዋል።` };
}

// ---------- exam permissions ----------

export async function grantExemption(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const reason = text(fd, 'reason');
  if (reason.length < 3) return { error: 'ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('final_exemptions').insert({ offering_id: text(fd, 'offering_id'), member_id: text(fd, 'member_id'), reason });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: '✓' };
}

export async function grantMakeup(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const reason = text(fd, 'reason');
  if (reason.length < 3) return { error: 'ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('makeup_grants').insert({ offering_id: text(fd, 'offering_id'), member_id: text(fd, 'member_id'), reason });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: '✓' };
}

export async function revokeMakeup(offeringId: string, memberId: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { error, count } = await supabase.from('makeup_grants').delete({ count: 'exact' }).eq('offering_id', offeringId).eq('member_id', memberId);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ጥቅም ላይ የዋለ ፈቃድ መሰረዝ አይቻልም።' };
  refresh();
}

// ---------- year end ----------

export async function setYearDecision(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const year_id = text(fd, 'year_id');
  const member_id = text(fd, 'member_id');
  const decision = text(fd, 'decision');
  const supabase = await createClient();
  if (decision === 'auto') {
    const { error } = await supabase.from('year_decisions').delete().eq('year_id', year_id).eq('member_id', member_id);
    if (error) return { error: explain(error.message) };
  } else {
    if (decision !== 'promoted' && decision !== 'repeat') return { error: 'ውሳኔ ይምረጡ።' };
    const { error } = await supabase.from('year_decisions')
      .upsert({ year_id, member_id, decision, remark: text(fd, 'remark') || null }, { onConflict: 'year_id,member_id' });
    if (error) return { error: explain(error.message) };
  }
  refresh();
  return { ok: '✓' };
}

export async function openYearTranscript(yearId: string, memberId: string) {
  await requireDept('education');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('issue_year_transcript', { p_year: yearId, p_member: memberId });
  if (error || !data) return { error: explain(error?.message ?? 'አልተቻለም።') };
  redirect(`/staff/transcripts/${data}`);
}
