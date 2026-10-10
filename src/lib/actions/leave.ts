'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { LEAVE_REASON } from '@/lib/constants';
import type { FormState } from '@/components/media-form';

/** A signed-in member asks for their own መልቀቂያ; ጽሕፈት ቤት decides as usual. */
export async function requestMyLeave(_: FormState, fd: FormData): Promise<FormState> {
  const category = String(fd.get('reason_category') ?? '');
  const reason = String(fd.get('reason_text') ?? '').trim();
  const leave = String(fd.get('leave_date') ?? '').trim();
  if (!(category in LEAVE_REASON)) return { error: 'ምክንያቱን ይምረጡ።' };
  if (reason.length < 3) return { error: 'ምክንያቱን በአጭሩ ይጻፉ።' };
  if (leave && !/^\d{4}-\d{2}-\d{2}$/.test(leave)) return { error: 'ቀኑ ትክክል አይደለም።' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_my_departure', { p_category: category, p_reason: reason, p_leave: leave || null });
  if (error) {
    if (error.message.includes('already_requested')) return { error: 'ቀደም ብለው ጠይቀዋል — ውሳኔውን ከታች ይመልከቱ።' };
    if (error.message.includes('not a member')) return { error: 'እባክዎ በመለያ ቁጥርዎና በኮድዎ ይግቡ።' };
    return { error: 'መላክ አልተቻለም።' };
  }
  revalidatePath('/student/leave');
  return { ok: 'ጥያቄዎ ደርሷል። ጽሕፈት ቤት ሲወስን እዚሁ ያያሉ።' };
}
