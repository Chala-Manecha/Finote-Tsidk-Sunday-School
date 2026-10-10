'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const date = (fd: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(text(fd, k)) ? text(fd, k) : null);
const mark = (fd: FormData, k: string) => {
  const v = text(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
const days = (fd: FormData) => fd.getAll('days').map(Number).filter((d) => d >= 0 && d <= 6);
const refresh = () => revalidatePath('/', 'layout');

async function save(table: string, id: string | null, row: Record<string, unknown>, okNew: string) {
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from(table).update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from(table).insert(row, { count: 'exact' });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: id ? 'ተቀይሯል።' : okNew };
}
async function remove(table: string, id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

// ---------- የአመቱ ዕቅድ ----------
export async function savePlan(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const course_name = text(fd, 'course_name');
  if (!course_name) return { error: 'የኮርሱን ስም ያስገቡ።' };
  return save('edu_plan', text(fd, 'id') || null, {
    course_name,
    class_name: text(fd, 'class_name') || null,
    teacher: text(fd, 'teacher') || null,
    start_date: date(fd, 'start_date'),
    mid_exam_date: date(fd, 'mid_exam_date'),
    final_exam_date: date(fd, 'final_exam_date'),
    mid_mark: mark(fd, 'mid_mark'),
    final_mark: mark(fd, 'final_mark'),
    notebook_mark: mark(fd, 'notebook_mark'),
    attendance_mark: mark(fd, 'attendance_mark'),
  }, 'ኮርስ ተጨምሯል።');
}
export async function deletePlan(id: string) { return remove('edu_plan', id); }

// ---------- ኮርስ ቀጣይ ቀጠሮዎች ----------
export async function saveCourseSession(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const name = text(fd, 'name');
  if (!name) return { error: 'የኮርሱን ስም ያስገቡ።' };
  const d = days(fd);
  if (d.length === 0) return { error: 'ቢያንስ አንድ ቀን ይምረጡ።' };
  return save('course_sessions', text(fd, 'id') || null, {
    name, class_name: text(fd, 'class_name') || null, teacher: text(fd, 'teacher') || null, days: d,
  }, 'ተጨምሯል።');
}
export async function deleteCourseSession(id: string) { return remove('course_sessions', id); }

// ---------- አብነት ----------
export async function saveAbnet(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const subject = text(fd, 'subject');
  const day_text = text(fd, 'day_text');
  const time_text = text(fd, 'time_text');
  const teacher = text(fd, 'teacher');
  if (!subject) return { error: 'የሚሰጡ ትምህርቶችን ያስገቡ።' };
  if (!day_text) return { error: 'ቀን ያስገቡ።' };
  if (!time_text) return { error: 'ሰዐት ያስገቡ።' };
  if (!teacher) return { error: 'መምህር ያስገቡ።' };
  const upload = (k: string) => { const v = text(fd, `${k}_path`); return v.startsWith('abnet/') ? v : undefined; };
  const audio = upload('audio') ?? (fd.get('remove_audio') === 'on' ? null : undefined);
  const file = upload('file') ?? (fd.get('remove_file') === 'on' ? null : undefined);
  const supabase = await createClient();
  const { data: old } = id
    ? await supabase.from('abnet_sessions').select('audio_path, file_path').eq('id', id).maybeSingle()
    : { data: null };
  const row = {
    subject, day_text, time_text, teacher,
    ...(audio !== undefined ? { audio_path: audio } : {}), ...(file !== undefined ? { file_path: file } : {}),
  };
  const res = await save('abnet_sessions', id, row, 'ተጨምሯል።');
  if (!res.error && old) {
    const gone = [audio !== undefined && old.audio_path, file !== undefined && old.file_path]
      .filter((x): x is string => !!x && x !== audio && x !== file);
    if (gone.length) await supabase.storage.from('media').remove(gone);
  }
  return res;
}
export async function deleteAbnet(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('abnet_sessions').select('audio_path, file_path').eq('id', id).maybeSingle();
  const res = await remove('abnet_sessions', id);
  const paths = [old?.audio_path, old?.file_path].filter((x): x is string => !!x);
  if (!res?.error && paths.length) await supabase.storage.from('media').remove(paths);
  return res;
}
