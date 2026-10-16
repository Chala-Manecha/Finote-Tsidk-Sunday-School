import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, DUTIES, DUTY_DEPTS, OCCASIONS } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DUTY_COLS, DutyTable, type DutyRow } from '@/components/duty-table';
import { AutoSubmit } from '@/components/auto-submit';
import { PrintButton } from '@/components/print-button';

export default async function HrAllDuties({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ q?: string; d?: string; duty?: string; occasion?: string; past?: string; st?: string; src?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr' && dept !== 'internal_comm') notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from('duty_assignments')
    .select(DUTY_COLS)
    .order('duty_date');
  if (!sp.past) q = q.gte('duty_date', todayIsoAddis());
  if (sp.d === 'self') q = q.is('dept', null);
  else if (sp.d) q = q.eq('dept', sp.d);
  if (sp.src === 'given' || sp.src === 'chosen') q = q.eq('source', sp.src);
  if (sp.duty) q = q.eq('duty', sp.duty);
  if (sp.occasion) q = q.eq('occasion', sp.occasion);
  if (sp.st === 'done' || sp.st === 'missed') q = q.eq('status', sp.st);
  if (sp.st === 'pending') q = q.is('status', null);
  const { data } = await q.returns<DutyRow[]>();
  const needle = sp.q?.trim();
  const rows = (data ?? []).filter((r) => !needle || r.members?.full_name.includes(needle));

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>{dept === 'hr' ? 'ሁሉም የስራ ምደባዎች' : 'የአባላት ስራ ምደባ'}</h2>
        <PrintButton />
      </div>
      <form className="toolbar no-print" action={`/staff/${dept}/all-duties`}>
        <div className="field">
          <label htmlFor="q">ስም</label>
          <input id="q" name="q" defaultValue={needle} />
        </div>
        <div className="field">
          <label htmlFor="d">ክፍል</label>
          <select id="d" name="d" defaultValue={sp.d ?? ''}>
            <option value="">ሁሉም</option>
            {DUTY_DEPTS.map((x) => <option key={x} value={x}>{DEPT_NAME[x]}</option>)}
            <option value="self">በራሳቸው የመረጡ</option>
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
          <label htmlFor="occasion">በአል</label>
          <select id="occasion" name="occasion" defaultValue={sp.occasion ?? ''}>
            <option value="">ሁሉም</option>
            {OCCASIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="src">ምንጭ</label>
          <select id="src" name="src" defaultValue={sp.src ?? ''}>
            <option value="">ሁሉም</option>
            <option value="given">ተመድበው</option>
            <option value="chosen">መርጠው</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="st">ሁኔታ</label>
          <select id="st" name="st" defaultValue={sp.st ?? ''}>
            <option value="">ሁሉም</option>
            <option value="done">ፈጽሟል</option>
            <option value="missed">አልፈጸመም</option>
            <option value="pending">ያልተረጋገጠ</option>
          </select>
        </div>
        <label className="check"><input type="checkbox" name="past" defaultChecked={!!sp.past} /> ያለፉትንም</label>
        <button className="btn sm">አጣራ</button>
        <AutoSubmit />
      </form>
      <p className="muted small">
        {rows.length} ምደባዎች · ተመድበው {rows.filter((r) => r.source === 'given').length} · መርጠው {rows.filter((r) => r.source === 'chosen').length} · ፈጽሟል {rows.filter((r) => r.status === 'done').length} · አልፈጸመም {rows.filter((r) => r.status === 'missed').length} · ያልተረጋገጠ {rows.filter((r) => !r.status).length}
      </p>
      <DutyTable rows={rows} members={[]} showDept confirmChosen />
    </>
  );
}
