import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { PropertyFields, PropertyTable, type PropertyRow } from '@/components/property-table';
import { PrintButton } from '@/components/print-button';
import { saveProperty } from '@/lib/actions/property';

export default async function OfficeDeptProperty({
  params, searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const { d } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from('dept_property').select('id, name, qty, price, condition, owner_dept').order('owner_dept').order('name');
  if (d) q = q.eq('owner_dept', d);
  const { data } = await q;
  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የክፍላት ንብረት አስተዳደር</h2>
        <PrintButton />
      </div>
      <MediaForm action={saveProperty} submitLabel="+ ንብረት መዝግብ"><PropertyFields /></MediaForm>
      <form className="toolbar no-print" action="/staff/office/dept-property">
        <div className="field">
          <label htmlFor="d">ክፍል</label>
          <select id="d" name="d" defaultValue={d ?? ''}>
            <option value="">ሁሉም</option>
            {DEPARTMENTS.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </div>
        <button className="btn sm">አጣራ</button>
      </form>
      <PropertyTable rows={(data ?? []) as PropertyRow[]} editable showDept />
    </>
  );
}
