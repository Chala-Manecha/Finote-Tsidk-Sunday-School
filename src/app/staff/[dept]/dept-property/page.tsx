import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { PROPERTY_COLS, PropertyFields, PropertyTable, type PropertyRow } from '@/components/property-table';
import { PrintButton } from '@/components/print-button';
import { saveProperty } from '@/lib/actions/property';

/** ሒሳብና ንብረት manages every department's property; ጽሕፈት ቤት only views it. */
export default async function DeptProperty({
  params, searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'office' && dept !== 'finance') notFound();
  const canEdit = dept === 'finance';
  const { d } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from('dept_property').select(PROPERTY_COLS).order('owner_dept').order('name');
  if (d) q = q.eq('owner_dept', d);
  const { data } = await q;
  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የክፍላት ንብረት አስተዳደር</h2>
        <PrintButton />
      </div>
      {canEdit
        ? <MediaForm action={saveProperty} submitLabel="+ ንብረት መዝግብ"><PropertyFields source="inherited" /></MediaForm>
        : <p className="muted small">የክፍላት ንብረትን የሚመዘግበውና የሚያስተካክለው ሒሳብና ንብረት አስተዳደር ነው።</p>}
      {canEdit && <p className="small muted no-print">እዚህ የሚመዘገበው ንብረት ምንጩ “ካለፈው የተረከበ” ነው። ክፍላት አዲስ የገዙትን “አዲስ የተገዛ ንብረት ለማጸደቅ” ትር ላይ ያጸድቁ።</p>}
      <form className="toolbar no-print" action={`/staff/${dept}/dept-property`}>
        <div className="field">
          <label htmlFor="d">ክፍል</label>
          <select id="d" name="d" defaultValue={d ?? ''}>
            <option value="">ሁሉም</option>
            {DEPARTMENTS.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </div>
        <button className="btn sm">አጣራ</button>
      </form>
      <PropertyTable rows={(data ?? []) as PropertyRow[]} editable={canEdit} showDept />
    </>
  );
}
