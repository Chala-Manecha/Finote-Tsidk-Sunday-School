'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SONG_CATEGORY_LABEL } from '@/lib/constants';

export type FormState = { error?: string; ok?: string };

const refresh = () => {
  revalidatePath('/staff', 'layout');
  revalidatePath('/zema');
  revalidatePath('/abnet');
};
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/** Audio is uploaded from the browser to Storage first; we only receive its path. */
function audioPath(fd: FormData, folder: 'songs' | 'wereb' | 'abnet') {
  const p = text(fd, 'audio_path');
  return p && p.startsWith(`${folder}/`) ? p : null;
}

async function removeOldAudio(oldPath: string | null | undefined, newPath: string | null) {
  if (oldPath && oldPath !== newPath) {
    const supabase = await createClient();
    await supabase.storage.from('media').remove([oldPath]);
  }
}

// ---------- መዝሙራት (መዝሙር ክፍል) ----------

export async function saveSong(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const title = text(fd, 'title');
  const category = text(fd, 'category');
  if (!title) return { error: 'የመዝሙሩን ርዕስ ያስገቡ።' };
  if (!(category in SONG_CATEGORY_LABEL)) return { error: 'ምድብ ይምረጡ።' };
  const row = { title, category, body: text(fd, 'body') || null, audio_path: audioPath(fd, 'songs') };

  const supabase = await createClient();
  if (id) {
    const { data: old } = await supabase.from('songs').select('audio_path').eq('id', id).maybeSingle();
    if (text(fd, 'keep_audio') === '1' && !row.audio_path) row.audio_path = old?.audio_path ?? null;
    const { error, count } = await supabase.from('songs').update(row, { count: 'exact' }).eq('id', id);
    if (error) return { error: error.message };
    if (!count) return { error: 'ፈቃድ የለዎትም።' };
    await removeOldAudio(old?.audio_path, row.audio_path);
  } else {
    const { error } = await supabase.from('songs').insert(row);
    if (error) return { error: error.message };
  }
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'መዝሙር ተጨምሯል።' };
}

export async function deleteSong(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('songs').select('audio_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('songs').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  await removeOldAudio(old?.audio_path, null);
  refresh();
}

// ---------- ወረብ (ትምህርት ክፍል) ----------

export async function saveWereb(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const title = text(fd, 'title');
  if (!title) return { error: 'ርዕስ ያስገቡ።' };
  const row = { title, body: text(fd, 'body') || null, audio_path: audioPath(fd, 'wereb') };

  const supabase = await createClient();
  if (id) {
    const { data: old } = await supabase.from('wereb_items').select('audio_path').eq('id', id).maybeSingle();
    if (text(fd, 'keep_audio') === '1' && !row.audio_path) row.audio_path = old?.audio_path ?? null;
    const { error, count } = await supabase.from('wereb_items').update(row, { count: 'exact' }).eq('id', id);
    if (error) return { error: error.message };
    if (!count) return { error: 'ፈቃድ የለዎትም።' };
    await removeOldAudio(old?.audio_path, row.audio_path);
  } else {
    const { error } = await supabase.from('wereb_items').insert(row);
    if (error) return { error: error.message };
  }
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ወረብ ተጨምሯል።' };
}

export async function deleteWereb(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('wereb_items').select('audio_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('wereb_items').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  await removeOldAudio(old?.audio_path, null);
  refresh();
}

// ---------- ማሕሌት (ትምህርት ክፍል → አብነት) ----------
export async function saveMahlet(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const title = text(fd, 'title');
  if (!title) return { error: 'ርዕስ ያስገቡ።' };
  const row = { title, body: text(fd, 'body') || null, audio_path: audioPath(fd, 'abnet') };
  const supabase = await createClient();
  if (id) {
    const { data: old } = await supabase.from('mahlet_items').select('audio_path').eq('id', id).maybeSingle();
    if (text(fd, 'keep_audio') === '1' && !row.audio_path) row.audio_path = old?.audio_path ?? null;
    const { error, count } = await supabase.from('mahlet_items').update(row, { count: 'exact' }).eq('id', id);
    if (error) return { error: error.message };
    if (!count) return { error: 'ፈቃድ የለዎትም።' };
    await removeOldAudio(old?.audio_path, row.audio_path);
  } else {
    const { error } = await supabase.from('mahlet_items').insert(row);
    if (error) return { error: error.message };
  }
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ማሕሌቱ ተጨምሯል።' };
}

export async function deleteMahlet(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('mahlet_items').select('audio_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('mahlet_items').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  await removeOldAudio(old?.audio_path, null);
  refresh();
}

// ---------- one ማሕሌት, several named audios ----------
export async function saveMahletAudio(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const mahlet_id = text(fd, 'mahlet_id');
  const title = text(fd, 'title').slice(0, 160);
  const audio_path = audioPath(fd, 'abnet');
  if (!mahlet_id) return { error: 'ማሕሌቱ አልተገኘም።' };
  if (!title) return { error: 'የድምፁን ስም ያስገቡ።' };
  if (!audio_path) return { error: 'የድምፅ ፋይል ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('mahlet_audios').insert({ mahlet_id, title, audio_path });
  if (error) {
    await supabase.storage.from('media').remove([audio_path]);
    return { error: error.message };
  }
  refresh();
  return { ok: 'ድምፁ ተጨምሯል።' };
}

export async function deleteMahletAudio(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('mahlet_audios').select('audio_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('mahlet_audios').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  await removeOldAudio(old?.audio_path, null);
  refresh();
}
