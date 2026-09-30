import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DUTY_DEPTS } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DutyForm } from '@/components/duty-form';
import { DutyTable, type DutyRow } from '@/components/duty-table';
import { PrintButton } from '@/components/print-button';

export default async function DeptDutyPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ q?: string; past?: string }>;
}) {
  const { dept } = await params;
  if (!(DUTY_DEPTS as readonly string[]).includes(dept)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from('duty_assignments')
    .select('id, member_id, dept, duty, duty_date, occasion, members(full_name)')
    .eq('dept', dept)
    .order('duty_date');
  if (!sp.past) q = q.gte('duty_date', todayIsoAddis());
  const [{ data: rows }, { data: members }] = await Promise.all([
    q.returns<DutyRow[]>(),
    supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);
  const needle = sp.q?.trim();
  const shown = (rows ?? []).filter((r) => !needle || r.members?.full_name.includes(needle));

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>አባል መድብ</h2>
      <DutyForm dept={dept} members={members ?? []} />
      <form className="toolbar no-print" action={`/staff/${dept}/duty`}>
        <div className="field">
          <label htmlFor="q">ስም</label>
          <input id="q" name="q" defaultValue={needle} />
        </div>
        <label className="check"><input type="checkbox" name="past" defaultChecked={!!sp.past} /> ያለፉትንም አሳይ</label>
        <button className="btn sm">አጣራ</button>
        <span style={{ flex: 1 }} />
        <PrintButton />
      </form>
      <DutyTable rows={shown} members={members ?? []} editableDept={dept} />
    </>
  );
}
