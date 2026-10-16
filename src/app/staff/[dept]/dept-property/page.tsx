import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { PROPERTY_COLS, PropertyFields, PropertyTable, type PropertyRow } from '@/components/property-table';
import { PrintButton } from '@/components/print-button';
import { saveProperty } from '@/lib/actions/property';
import { Modal } from '@/components/modal';
import { AutoSubmit } from '@/components/auto-submit';

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
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የክፍላት ንብረት አስተዳደር</h2>
        <span className="count-badge">{(data ?? []).length}</span>
        <span className="spacer" />
        <form className="toolbar slim no-print" action={`/staff/${dept}/dept-property`}>
          <select name="d" defaultValue={d ?? ''} aria-label="ክፍል">
            <option value="">ሁሉም ክፍሎች</option>
            {DEPARTMENTS.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
          <AutoSubmit />
        </form>
        <PrintButton />
        {canEdit && (
          <Modal label="+ ንብረት መዝግብ" title="ንብረት መዝግብ" sub="ካለፈው የተረከበ ንብረት" size="lg">
            <MediaForm action={saveProperty} submitLabel="+ ንብረት መዝግብ" card={false}><PropertyFields source="inherited" /></MediaForm>
          </Modal>
        )}
      </div>
      <p className="small muted no-print">{canEdit
        ? 'እዚህ የሚመዘገበው ንብረት ምንጩ “ካለፈው የተረከበ” ነው። ክፍላት አዲስ የገዙትን “አዲስ የተገዛ ንብረት ለማጸደቅ” ትር ላይ ያጸድቁ።'
        : 'የክፍላት ንብረትን የሚመዘግበውና የሚያስተካክለው ሒሳብና ንብረት አስተዳደር ነው።'}</p>
      <PropertyTable rows={(data ?? []) as PropertyRow[]} editable={canEdit} showDept />
    </>
  );
}
