'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { COMPONENTS } from '@/lib/education';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ERR: Record<string, string> = {
  over_weight: 'ከተፈቀደው ነጥብ በላይ የገባ ውጤት አለ።',
  marks_locked: 'ውጤቱ ለማጽደቅ ቀርቧል ወይም ጸድቋል፤ መቀየር አይቻልም።',
  own_marks: 'የራስዎን ውጤት መሙላት አይችሉም።',
  not_in_class: 'ተማሪው በዚህ ክፍል አልተመዘገበም።',
  finals_missing: 'ለሁሉም ተማሪዎች የዋና ፈተና ውጤት መሞላት አለበት።',
  low_attendance: 'ክትትላቸው ዝቅተኛ የሆነ ተማሪ ያለ ትምህርት ክፍል ፈቃድ ዋና ፈተና አይመዘገብለትም።',
};
const explain = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? (m.includes('row-level') ? 'ፈቃድ የለዎትም።' : m);

/** Teacher: save the marks grid for one course (blank = not yet entered). */
export async function saveMarks(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const offering_id = text(fd, 'offering_id');
  if (!UUID_RE.test(offering_id)) return { error: 'ኮርስ አልተገኘም።' };
  const ids = fd.getAll('member_id').map(String).filter((x) => UUID_RE.test(x));
  const rows = [];
  if (fd.get('makeup_only') === '1') {
    // after submission: only granted make-up finals
    for (const member_id of ids) {
      const raw = text(fd, `final_${member_id}`);
      if (raw === '') continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: `ትክክል ያልሆነ ቁጥር፦ ${raw}` };
      rows.push({ offering_id, member_id, final: Math.round(n * 100) / 100 });
    }
    if (rows.length === 0) return { error: 'የድጋሚ ፈተና ውጤት አልገባም።' };
    const supabase = await createClient();
    const { error } = await supabase.from('marks').upsert(rows, { onConflict: 'offering_id,member_id' });
    if (error) return { error: explain(error.message) };
    revalidatePath(`/student/teach/${offering_id}`);
    return { ok: 'የድጋሚ ፈተና ውጤት ተቀምጧል።' };
  }
  for (const member_id of ids) {
    const row: Record<string, string | number | null> = { offering_id, member_id };
    let any = false;
    for (const c of COMPONENTS) {
      const raw = text(fd, `${c.key}_${member_id}`);
      if (raw === '') { row[c.key] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: `ትክክል ያልሆነ ቁጥር፦ ${raw}` };
      row[c.key] = Math.round(n * 100) / 100;
      any = true;
    }
    if (any) rows.push(row);
  }
  if (rows.length === 0) return { error: 'ምንም ውጤት አልገባም።' };
  const supabase = await createClient();
  const { error } = await supabase.from('marks').upsert(rows, { onConflict: 'offering_id,member_id' });
  if (error) return { error: explain(error.message) };
  revalidatePath(`/student/teach/${offering_id}`);
  return { ok: `${rows.length} ተማሪዎች ውጤት ተቀምጧል።` };
}

/** Teacher: attendance for one class meeting. */
export async function saveClassAttendance(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember();
  const offering_id = text(fd, 'offering_id');
  const session_date = text(fd, 'session_date');
  if (!UUID_RE.test(offering_id) || !DATE_RE.test(session_date)) return { error: 'ቀን ይምረጡ።' };
  const supabase = await createClient();
  const { data: sess, error: e1 } = await supabase.from('class_sessions')
    .upsert({ offering_id, session_date }, { onConflict: 'offering_id,session_date' }).select('id').single();
  if (e1 || !sess) return { error: explain(e1?.message ?? 'ፈቃድ የለዎትም።') };
  const rows = fd.getAll('member_id').map(String).filter((x) => UUID_RE.test(x)).map((member_id) => ({
    session_id: sess.id, member_id,
    status: (['present', 'half', 'absent'].includes(text(fd, `att_${member_id}`)) ? text(fd, `att_${member_id}`) : 'absent'),
  }));
  const { error } = await supabase.from('class_attendance').upsert(rows, { onConflict: 'session_id,member_id' });
  if (error) return { error: explain(error.message) };
  revalidatePath(`/student/teach/${offering_id}`);
  return { ok: 'ክትትሉ ተቀምጧል።' };
}

/** Teacher: send the course's results to ትምህርት ክፍል for approval. */
export async function submitOffering(id: string) {
  await requireMember();
  const supabase = await createClient();
  const { error, count } = await supabase.from('course_offerings').update({ status: 'submitted' }, { count: 'exact' }).eq('id', id);
  if (error) return { error: explain(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  revalidatePath(`/student/teach/${id}`);
  revalidatePath('/student');
}
