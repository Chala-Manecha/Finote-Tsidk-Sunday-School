'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, SONG_CATEGORY_LABEL } from '@/lib/constants';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const refresh = () => revalidatePath('/', 'layout');

function pathIn(fd: FormData, field: string, folder: string) {
  const p = text(fd, `${field}_path`);
  return p.startsWith(`${folder}/`) ? p : null;
}
async function removeMedia(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from('media').remove([path]);
}
const denied = (count: number | null) => (!count ? { error: 'ፈቃድ የለዎትም።' } : null);

// ---------- ዝግጅት ፎቶዎች (home marquee) ----------
export async function addPhoto(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const image_path = pathIn(fd, 'image', 'photos');
  if (!image_path) return { error: 'ፎቶ ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('event_photos').insert({ image_path, caption: text(fd, 'caption') || null });
  if (error) { await removeMedia(image_path); return { error: error.message }; }
  refresh();
  return { ok: 'ፎቶ ተጨምሯል።' };
}
export async function deletePhoto(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from('event_photos').select('image_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('event_photos').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  await removeMedia(data?.image_path);
  refresh();
}

// ---------- ታሪካችን ----------
export async function saveHistory(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const category = text(fd, 'category');
  const media_type = text(fd, 'media_type') === 'video' ? 'video' : 'photo';
  const item_date = text(fd, 'item_date');
  if (!(category in SONG_CATEGORY_LABEL)) return { error: 'ምድብ ይምረጡ።' };
  if (item_date && !DATE_RE.test(item_date)) return { error: 'ቀን ትክክል አይደለም።' };
  const newPath = pathIn(fd, 'media', 'history');
  const supabase = await createClient();
  const row = { category, media_type, caption: text(fd, 'caption') || null, item_date: item_date || null };

  if (id) {
    const { data: old } = await supabase.from('history_items').select('media_path').eq('id', id).maybeSingle();
    const { error, count } = await supabase.from('history_items')
      .update(newPath ? { ...row, media_path: newPath } : row, { count: 'exact' }).eq('id', id);
    if (error) return { error: error.message };
    if (denied(count)) return denied(count)!;
    if (newPath) await removeMedia(old?.media_path);
  } else {
    if (!newPath) return { error: 'ፎቶ ወይም ቪዲዮ ይምረጡ።' };
    const { error } = await supabase.from('history_items').insert({ ...row, media_path: newPath });
    if (error) { await removeMedia(newPath); return { error: error.message }; }
  }
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}
export async function deleteHistory(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from('history_items').select('media_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('history_items').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  await removeMedia(data?.media_path);
  refresh();
}

// ---------- ክፍል ኃላፊዎች (one per department; drives the welcome banner) ----------
export async function saveAssignee(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const dept = text(fd, 'dept');
  const name = text(fd, 'full_name').replace(/\s+/g, ' ');
  if (!(dept in DEPT_NAME)) return { error: 'ክፍል ይምረጡ።' };
  if (!name) return { error: 'ስም ያስገቡ።' };
  const supabase = await createClient();
  // The head must be a registered (active) member — picked by their full name.
  const { data: found } = await supabase.from('members').select('id, full_name, sex').eq('is_active', true).ilike('full_name', name).limit(2);
  if (!found || found.length === 0) return { error: 'ይህ ስም አልተመዘገበም!' };
  if (found.length > 1) return { error: 'በዚህ ስም ከአንድ በላይ አባል አለ፤ ሙሉ ስሙን (ከአያት ስም ጋር) ያስገቡ።' };
  const m = found[0];
  const { data: old } = await supabase.from('dept_assignees').select('photo_path').eq('dept', dept).maybeSingle();
  const { error } = await supabase.from('dept_assignees').upsert({
    dept, full_name: m.full_name, sex: m.sex, member_id: m.id, user_id: null, photo_path: null,
  });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  await removeMedia(old?.photo_path);
  refresh();
  return { ok: `${m.full_name} የ${DEPT_NAME[dept]} ኃላፊ ሆነዋል። በራሳቸው መለያ ቁጥርና ኮድ ገብተው የክፍሉን ገጽ ያያሉ።` };
}
export async function deleteAssignee(dept: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from('dept_assignees').select('photo_path').eq('dept', dept).maybeSingle();
  const { error, count } = await supabase.from('dept_assignees').delete({ count: 'exact' }).eq('dept', dept);
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  await removeMedia(data?.photo_path);
  refresh();
}

// ---------- ማኅበራት ----------
export async function saveMahiber(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const association_name = text(fd, 'association_name');
  const event_date = text(fd, 'event_date');
  const event_time = text(fd, 'event_time');
  if (!association_name) return { error: 'የማኅበሩን ስም ያስገቡ።' };
  if (!DATE_RE.test(event_date)) return { error: 'ቀን ይምረጡ።' };
  const row = { association_name, event_date, event_time: event_time || null, rescheduled: fd.get('rescheduled') === 'on' };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('mahiberat').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('mahiberat').insert(row, { count: 'exact' });
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}
export async function deleteMahiber(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('mahiberat').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  refresh();
}

// ---------- የጸሎት መርኀ ግብር ----------
export async function savePrayer(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, 'id') || null;
  const program = text(fd, 'program');
  const days = fd.getAll('days').map(Number).filter((d) => d >= 0 && d <= 6);
  const times = text(fd, 'times').split(/[,،፣\n]/).map((t) => t.trim()).filter(Boolean);
  if (!program) return { error: 'መርኀ ግብር ይምረጡ።' };
  if (days.length === 0) return { error: 'ቢያንስ አንድ ቀን ይምረጡ።' };
  const row = { program, days, times };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from('prayer_schedule').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('prayer_schedule').insert(row, { count: 'exact' });
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  refresh();
  return { ok: id ? 'ተቀይሯል።' : 'ተጨምሯል።' };
}
export async function deletePrayer(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('prayer_schedule').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (denied(count)) return denied(count)!;
  refresh();
}

// ---------- Department description PDFs ----------
export async function saveDeptDoc(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const dept = text(fd, 'dept');
  if (!(dept in DEPT_NAME)) return { error: 'ክፍል ይምረጡ።' };
  const file_path = pathIn(fd, 'file', 'docs');
  if (!file_path) return { error: 'PDF ፋይል ይምረጡ።' };
  if (!file_path.endsWith('.pdf')) { await removeMedia(file_path); return { error: 'PDF ፋይል ብቻ ይፈቀዳል።' }; }
  const supabase = await createClient();
  const { data: old } = await supabase.from('dept_documents').select('file_path').eq('dept', dept).maybeSingle();
  const { error } = await supabase.from('dept_documents')
    .upsert({ dept, file_path, file_name: `${DEPT_NAME[dept]}.pdf` }, { onConflict: 'dept' });
  if (error) { await removeMedia(file_path); return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message }; }
  if (old?.file_path && old.file_path !== file_path) await removeMedia(old.file_path);
  refresh();
  return { ok: 'ተጭኗል።' };
}

export async function deleteDeptDoc(dept: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: old } = await supabase.from('dept_documents').select('file_path').eq('dept', dept).maybeSingle();
  const { error, count } = await supabase.from('dept_documents').delete({ count: 'exact' }).eq('dept', dept);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  await removeMedia(old?.file_path);
  refresh();
}

// ---------- Leadership terms (የአመራር ቡድን) ----------
export async function saveTerm(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const name = text(fd, 'name');
  const teamNo = text(fd, 'team_no');
  const team_no = teamNo ? Number(teamNo) : null;
  const starts_on = text(fd, 'starts_on');
  const ends_on = text(fd, 'ends_on') || null;
  if (!name) return { error: 'የቡድኑን ስም ያስገቡ።' };
  if (team_no !== null && (!Number.isInteger(team_no) || team_no < 1)) return { error: 'የቡድን ቁጥር ትክክል አይደለም።' };
  if (!DATE_RE.test(starts_on)) return { error: 'የመጀመሪያ ቀን ይምረጡ።' };
  if (ends_on && (!DATE_RE.test(ends_on) || ends_on < starts_on)) return { error: 'የማብቂያ ቀን ትክክል አይደለም።' };
  const supabase = await createClient();
  const { data: active } = await supabase.from('leadership_terms').select('id').eq('is_active', true).maybeSingle();
  const { error } = await supabase.from('leadership_terms')
    .insert({ name, team_no, starts_on, ends_on, is_active: !active });
  if (error) return { error: error.message.includes('row-level') ? 'ፈቃድ የለዎትም።' : error.message };
  refresh();
  return { ok: active ? 'ተመዝግቧል። ንቁ ለማድረግ “ንቁ አድርግ” ይጫኑ።' : 'ተመዝግቧል፤ ንቁ ቡድን ሆኗል።' };
}

export async function setActiveTerm(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_active_term', { p_id: id });
  if (error) return { error: error.message.includes('row-level') || error.message.includes('permission') ? 'ፈቃድ የለዎትም።' : error.message };
  refresh();
}

export async function deleteTerm(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('leadership_terms').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}
