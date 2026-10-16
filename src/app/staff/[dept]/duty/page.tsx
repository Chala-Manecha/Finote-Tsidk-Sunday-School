import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DUTY_DEPTS } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DutyForm } from '@/components/duty-form';
import { DUTY_COLS, DutyTable, type DutyRow } from '@/components/duty-table';
import { PrintButton } from '@/components/print-button';
import { Modal } from '@/components/modal';

/** የአባላት ስራ ምደባ: give a member a job (they accept it before the day), then confirm it was done. */
export default async function DeptDutyPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ q?: string; v?: string }>;
}) {
  const { dept } = await params;
  if (!(DUTY_DEPTS as readonly string[]).includes(dept)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  // የሚመጡ = upcoming · ማረጋገጫ = accepted, the day has passed, not yet confirmed · ሁሉም = everything
  const view = sp.v === 'confirm' || sp.v === 'all' ? sp.v : 'upcoming';
  const today = todayIsoAddis();
  let q = supabase.from('duty_assignments').select(DUTY_COLS).eq('dept', dept).order('duty_date', { ascending: view !== 'all' });
  if (view === 'upcoming') q = q.gte('duty_date', today);
  if (view === 'confirm') q = q.lte('duty_date', today).is('status', null).not('accepted_at', 'is', null);
  const [{ data: rows }, { data: members }, { count: waiting }, { count: awaiting }] = await Promise.all([
    q.returns<DutyRow[]>(),
    supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('duty_assignments').select('id', { count: 'exact', head: true }).eq('dept', dept).lte('duty_date', today).is('status', null).not('accepted_at', 'is', null),
    supabase.from('duty_assignments').select('id', { count: 'exact', head: true }).eq('dept', dept).gte('duty_date', today).is('accepted_at', null),
  ]);
  const base = `/staff/${dept}/duty`;
  const needle = sp.q?.trim();
  const shown = (rows ?? []).filter((r) => !needle || r.members?.full_name.includes(needle));
  const list = members ?? [];

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የአባላት ስራ ምደባ</h2>
        <div className="seg no-print">
          <Link className={view === 'upcoming' ? 'on' : ''} href={base}>የሚመጡ{awaiting ? ` · ${awaiting} ያልተቀበሉ` : ''}</Link>
          <Link className={view === 'confirm' ? 'on' : ''} href={`${base}?v=confirm`}>ማረጋገጫ የሚጠብቁ{waiting ? ` (${waiting})` : ''}</Link>
          <Link className={view === 'all' ? 'on' : ''} href={`${base}?v=all`}>ሁሉም</Link>
        </div>
        <span className="spacer" />
        <form className="toolbar slim no-print" action={base}>
          {view !== 'upcoming' && <input type="hidden" name="v" value={view} />}
          <input name="q" type="search" defaultValue={needle} placeholder="🔍 ስም" aria-label="ስም" style={{ width: 150 }} />
        </form>
        <PrintButton />
        <Modal label="+ አዲስ ምደባ" title="አባል መድብ" sub="አባሉ ከቀኑ በፊት በዳሽቦርዱ ሲቀበል ይጸድቃል" btnClass="btn sm green">
          <DutyForm dept={dept} members={list} plain />
        </Modal>
      </div>
      <p className="small muted no-print">
        {view === 'confirm'
          ? 'ቀኑ ያለፈ፣ አባሉ የተቀበለው ምደባ — መፈጸሙን ያረጋግጡ፤ በአባሉ የተሳትፎ መቶኛ ይቆጠራል።'
          : 'የተመደበ አባል ከቀኑ በፊት መቀበል አለበት፤ ካልተቀበለ ጊዜው ያልፍበታል። ከተቀበለ በኋላ መቀየርም ማጥፋትም አይቻልም።'}
      </p>
      <DutyTable rows={shown} members={list} editableDept={dept} />
    </>
  );
}
