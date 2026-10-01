'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';
import type { FormState } from '@/components/media-form';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const refresh = () => revalidatePath('/staff', 'layout');
const denied = (m: string) => (m.includes('only') || m.includes('row-level') || m.includes('permission') ? 'ፈቃድ የለዎትም።' : m);

// ---------- መልቀቂያ ----------

/** HR: record a leaving request and send it to ጽሕፈት ቤት. */
export async function requestDeparture(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const member_id = text(fd, 'member_id');
  const leave_date = text(fd, 'leave_date');
  const reason_text = text(fd, 'reason_text');
  const reason_category = text(fd, 'reason_category');
  if (!UUID_RE.test(member_id)) return { error: 'አባል ይምረጡ።' };
  if (!DATE_RE.test(leave_date)) return { error: 'ቀን ይምረጡ።' };
  if (!['moved', 'marriage', 'study', 'work', 'other_church', 'other'].includes(reason_category)) return { error: 'የምክንያት አይነት ይምረጡ።' };
  if (reason_text.length < 3) return { error: 'አባሉ የገለጹትን ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('member_departures').insert({ member_id, leave_date, reason_text, reason_category });
  if (error) {
    if (error.message.includes('one_open') || error.code === '23505') return { error: 'ለዚህ አባል ያልተዘጋ የመልቀቂያ ጥያቄ አለ።' };
    return { error: denied(error.message) };
  }
  refresh();
  return { ok: 'ጥያቄው ለጽሕፈት ቤት ተልኳል።' };
}

export async function withdrawDeparture(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('member_departures').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

/** ጽሕፈት ቤት: approve (with an optional commendation) or reject. */
export async function decideDeparture(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const decision = text(fd, 'decision');
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'ውሳኔ ይምረጡ።' };
  const note = text(fd, 'decision_note') || null;
  if (decision === 'rejected' && !note) return { error: 'የመከልከያ ምክንያት ይጻፉ።' };
  const supabase = await createClient();
  const { error, count } = await supabase.from('member_departures').update({
    status: decision, commendation: text(fd, 'commendation') || null, decision_note: note,
  }, { count: 'exact' }).eq('id', text(fd, 'id'));
  if (error) return { error: error.message.includes('duplicate_name') ? 'ተመሳሳይ ስም ያለው አባል አለ።' : denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
  return { ok: decision === 'approved' ? 'ጸድቋል፤ HR የምስክር ወረቀቱን ማተም ይችላል።' : 'ተከልክሏል።' };
}

export async function reinstateMember(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('member_departures')
    .update({ reinstated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', id);
  if (error) return { error: error.message.includes('duplicate_name') ? 'ተመሳሳይ ስም ያለው ንቁ አባል አለ።' : denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

// ---------- Leadership roles per term ----------

export async function saveLeaderRole(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const term_id = text(fd, 'term_id');
  const dept = text(fd, 'dept');
  const role = text(fd, 'role');
  const member_id = text(fd, 'member_id');
  if (!UUID_RE.test(term_id)) return { error: 'ቡድን ይምረጡ።' };
  if (!isDeptCode(dept)) return { error: 'ክፍል ይምረጡ።' };
  if (!['head', 'deputy', 'secretary'].includes(role)) return { error: 'ሚና ይምረጡ።' };
  if (!UUID_RE.test(member_id)) return { error: 'አባል ይምረጡ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('leadership_roles')
    .upsert({ term_id, dept, role, member_id }, { onConflict: 'term_id,dept,role' });
  if (error) return { error: denied(error.message) };
  refresh();
  return { ok: 'ተመዝግቧል።' };
}

export async function deleteLeaderRole(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error, count } = await supabase.from('leadership_roles').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: denied(error.message) };
  if (!count) return { error: 'ፈቃድ የለዎትም።' };
  refresh();
}

// ---------- Lost members follow-up (ኦዲት) ----------

export async function addFollowup(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const member_id = text(fd, 'member_id');
  const contacted_on = text(fd, 'contacted_on');
  const note = text(fd, 'note');
  if (!UUID_RE.test(member_id)) return { error: 'አባል አልተገኘም።' };
  if (!DATE_RE.test(contacted_on)) return { error: 'ቀን ይምረጡ።' };
  if (note.length < 2) return { error: 'ምን እንደተባለ ይጻፉ።' };
  const supabase = await createClient();
  const { error } = await supabase.from('lost_followups').insert({ member_id, contacted_on, note });
  if (error) return { error: denied(error.message) };
  refresh();
  return { ok: 'ተመዝግቧል።' };
}
