import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, DUTIES, DUTY_DEPTS, OCCASIONS } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DutyTable, type DutyRow } from '@/components/duty-table';
import { PrintButton } from '@/components/print-button';

export default async function HrAllDuties({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ q?: string; d?: string; duty?: string; occasion?: string; past?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from('duty_assignments')
    .select('id, member_id, dept, duty, duty_date, occasion, members(full_name)')
    .order('duty_date');
  if (!sp.past) q = q.gte('duty_date', todayIsoAddis());
  if (sp.d) q = q.eq('dept', sp.d);
  if (sp.duty) q = q.eq('duty', sp.duty);
  if (sp.occasion) q = q.eq('occasion', sp.occasion);
  const { data } = await q.returns<DutyRow[]>();
  const needle = sp.q?.trim();
  const rows = (data ?? []).filter((r) => !needle || r.members?.full_name.includes(needle));

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>ሁሉም ምደባዎች</h2>
        <PrintButton />
      </div>
      <form className="toolbar no-print" action="/staff/hr/all-duties">
        <div className="field">
          <label htmlFor="q">ስም</label>
          <input id="q" name="q" defaultValue={needle} />
        </div>
        <div className="field">
          <label htmlFor="d">ክፍል</label>
          <select id="d" name="d" defaultValue={sp.d ?? ''}>
            <option value="">ሁሉም</option>
            {DUTY_DEPTS.map((x) => <option key={x} value={x}>{DEPT_NAME[x]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="duty">ምድብ</label>
          <select id="duty" name="duty" defaultValue={sp.duty ?? ''}>
            <option value="">ሁሉም</option>
            {DUTIES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="occasion">ምክንያት</label>
          <select id="occasion" name="occasion" defaultValue={sp.occasion ?? ''}>
            <option value="">ሁሉም</option>
            {OCCASIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <label className="check"><input type="checkbox" name="past" defaultChecked={!!sp.past} /> ያለፉትንም</label>
        <button className="btn sm">አጣራ</button>
      </form>
      <p className="muted small">{rows.length} ምደባዎች</p>
      <DutyTable rows={rows} members={[]} showDept />
    </>
  );
}
