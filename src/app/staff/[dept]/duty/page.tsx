import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DUTY_DEPTS } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DutyForm } from '@/components/duty-form';
import { DutyTable, type DutyRow } from '@/components/duty-table';
import { PrintButton } from '@/components/print-button';
import { SegLinks } from '@/components/seg-links';

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

  // የሚመጡ = upcoming · ማረጋገጫ = past and not yet confirmed (did the member do the job?) · ሁሉም = everything
  const view = sp.v === 'confirm' || sp.v === 'all' ? sp.v : 'upcoming';
  const today = todayIsoAddis();
  let q = supabase
    .from('duty_assignments')
    .select('id, member_id, dept, duty, duty_date, occasion, status, members(full_name)')
    .eq('dept', dept)
    .order('duty_date', { ascending: view !== 'all' });
  if (view === 'upcoming') q = q.gt('duty_date', today);
  if (view === 'confirm') q = q.lte('duty_date', today).is('status', null);
  const [{ data: rows }, { data: members }, { count: waiting }] = await Promise.all([
    q.returns<DutyRow[]>(),
    supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('duty_assignments').select('id', { count: 'exact', head: true }).eq('dept', dept).lte('duty_date', today).is('status', null),
  ]);
  const base = `/staff/${dept}/duty`;
  const needle = sp.q?.trim();
  const shown = (rows ?? []).filter((r) => !needle || r.members?.full_name.includes(needle));

  return (
    <>
      <div className="head-row">
        <h2 className="section" style={{ margin: 0 }}>አባል መድብ</h2>
        <details className="pop no-print">
          <summary className="btn sm green">+ አዲስ ምደባ</summary>
          <div className="pop-body"><DutyForm dept={dept} members={members ?? []} plain /></div>
        </details>
      </div>
      <SegLinks current={view} items={[
        ['upcoming', 'የሚመጡ ምደባዎች', base],
        ['confirm', `ማረጋገጫ የሚጠብቁ${waiting ? ` (${waiting})` : ''}`, `${base}?v=confirm`],
        ['all', 'ሁሉም', `${base}?v=all`],
      ]} />
      {view === 'confirm' && <p className="small muted">ቀኑ ያለፈ ምደባ — አባሉ የተመደበበትን ሥራ መፈጸሙን ያረጋግጡ። የተረጋገጠው በአባሉ የተሳትፎ መቶኛ ይቆጠራል።</p>}
      <form className="toolbar no-print" action={base}>
        {view !== 'upcoming' && <input type="hidden" name="v" value={view} />}
        <div className="field">
          <label htmlFor="q">ስም</label>
          <input id="q" name="q" defaultValue={needle} />
        </div>
        <button className="btn sm">አጣራ</button>
        <span style={{ flex: 1 }} />
        <PrintButton />
      </form>
      <DutyTable rows={shown} members={members ?? []} editableDept={dept} />
    </>
  );
}
