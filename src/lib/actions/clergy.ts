'use server';
import { revalidatePath } from 'next/cache';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RANKS = ['deacon', 'priest', 'other'];
const STATUSES = ['serving', 'not_serving', 'away'];

/** ⛪ ካህናትና ዲያቆናት: add or edit one record (with an optional certificate file in edu-books/clergy/). */
export async function saveClergy(_: FormState, fd: FormData): Promise<FormState> {
  await requireDept('education');
  const id = text(fd, 'id');
  const supabase = await createClient();
  const member_id = text(fd, 'member_id');
  let full_name = text(fd, 'full_name');
  if (UUID_RE.test(member_id) && !full_name) {
    const { data: m } = await supabase.from('members').select('full_name').eq('id', member_id).maybeSingle();
    full_name = m?.full_name ?? '';
  }
  const rank = text(fd, 'rank');
  const service_status = text(fd, 'service_status');
  const ordained_on = text(fd, 'ordained_on');
  const file = text(fd, 'file_path');
  const drop = async () => { if (file) await supabase.storage.from('edu-books').remove([file]); };
  if (full_name.length < 2) { await drop(); return { error: 'አባል ይምረጡ ወይም ስም ያስገቡ።' }; }
  if (!RANKS.includes(rank) || !STATUSES.includes(service_status)) { await drop(); return { error: 'ማዕረግና የአገልግሎት ሁኔታ ይምረጡ።' }; }
  if (ordained_on && !DATE_RE.test(ordained_on)) { await drop(); return { error: 'ቀኑ ትክክል አይደለም።' }; }
  if (file && !file.startsWith('clergy/')) return { error: 'ፋይሉ አልተቀበለም።' };
  const row = {
    member_id: UUID_RE.test(member_id) ? member_id : null, full_name, rank, service_status,
    ordained_on: ordained_on || null, bishop: text(fd, 'bishop').slice(0, 120) || null, place: text(fd, 'place').slice(0, 160) || null,
    note: text(fd, 'note').slice(0, 500) || null,
    ...(file ? { file_path: file, file_name: text(fd, 'file_name').slice(0, 200) || null } : {}),
  };
  let old: string | null = null;
  if (id && file) old = (await supabase.from('clergy').select('file_path').eq('id', id).maybeSingle()).data?.file_path ?? null;
  const { error, count } = UUID_RE.test(id)
    ? await supabase.from('clergy').update(row, { count: 'exact' }).eq('id', id)
    : await supabase.from('clergy').insert(row, { count: 'exact' });
  if (error || !count) { await drop(); return { error: error?.message.includes('row-level') || !error ? 'ፈቃድ የለዎትም።' : error.message }; }
  if (old && old !== file) await supabase.storage.from('edu-books').remove([old]);
  revalidatePath('/staff', 'layout');
  return { ok: UUID_RE.test(id) ? 'ተቀይሯል።' : 'ተመዝግቧል።' };
}

export async function deleteClergy(id: string) {
  await requireDept('education');
  if (!UUID_RE.test(id)) return { error: 'አልተገኘም።' };
  const supabase = await createClient();
  const { data: old } = await supabase.from('clergy').select('file_path').eq('id', id).maybeSingle();
  const { error, count } = await supabase.from('clergy').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  if (old?.file_path) await supabase.storage.from('edu-books').remove([old.file_path]);
  revalidatePath('/staff', 'layout');
}
