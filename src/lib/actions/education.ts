'use server';
import { parseDelivery } from '@/lib/delivery';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
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

// ---------- አብነት ----------
export async function saveAbnet(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const subject = [...new Set(fd.getAll('subject').map((x) => String(x).trim()).filter(Boolean))].join('፣ ');
  const day_text = text(fd, 'day_text');
  const time_text = text(fd, 'time_text');
  const teacher = text(fd, 'teacher');
  if (!subject) return { error: 'የሚሰጡ ትምህርቶችን ያስገቡ።' };
  if (!day_text) return { error: 'ቀን ያስገቡ።' };
  if (!time_text) return { error: 'ሰዐት ያስገቡ።' };
  if (!teacher) return { error: 'መምህር ያስገቡ።' };
  const dl = parseDelivery(fd);
  if ('error' in dl) return dl;
  const upload = (k: string) => { const v = text(fd, `${k}_path`); return v.startsWith('abnet/') ? v : undefined; };
  const audio = upload('audio') ?? (fd.get('remove_audio') === 'on' ? null : undefined);
  const file = upload('file') ?? (fd.get('remove_file') === 'on' ? null : undefined);
  const supabase = await createClient();
  const { data: old } = id
    ? await supabase.from('abnet_sessions').select('audio_path, file_path').eq('id', id).maybeSingle()
    : { data: null };
  const place = text(fd, 'place').slice(0, 160) || null;
  const row = {
    subject, day_text, time_text, teacher, place, ...dl,
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

// ---------- አብነት materials (audio / video / files) ----------
export async function saveMaterial(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const kind = text(fd, 'kind');
  const title = text(fd, 'title').slice(0, 160);
  const description = text(fd, 'description').slice(0, 2000) || null;
  const uploaded = text(fd, 'file_path');
  const file_path = uploaded.startsWith('abnet/') ? uploaded : null;
  const url = text(fd, 'url') || null;
  if (!['audio', 'video', 'file'].includes(kind)) return { error: 'አይነቱን ይምረጡ።' };
  if (title.length < 2) return { error: 'ስም ያስገቡ።' };
  if (url && !/^https?:\/\//i.test(url)) return { error: 'ሊንኩ በ https:// መጀመር አለበት።' };
  const supabase = await createClient();
  if (id) {
    const { data: old } = await supabase.from('abnet_materials').select('file_path, url').eq('id', id).maybeSingle();
    const row = { kind, title, description, ...(file_path ? { file_path } : {}), ...(url !== null || file_path ? { url } : {}) };
    const res = await save('abnet_materials', id, row, 'ተጨምሯል።');
    if (!res.error && file_path && old?.file_path && old.file_path !== file_path) await supabase.storage.from('media').remove([old.file_path]);
    return res;
  }
  if (!file_path && !url) return { error: kind === 'video' ? 'ቪዲዮ ይጫኑ ወይም ሊንክ ያስገቡ።' : 'ፋይል ይጫኑ።' };
  return save('abnet_materials', null, { kind, title, description, file_path, url }, 'ተጨምሯል — በድረ ገጹ ላይ ይታያል።');
}
export async function deleteMaterial(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('abnet_materials').select('file_path').eq('id', id).maybeSingle();
  const res = await remove('abnet_materials', id);
  if (!res?.error && old?.file_path) await supabase.storage.from('media').remove([old.file_path]);
  return res;
}
