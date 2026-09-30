import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { PropertyFields, PropertyTable, type PropertyRow } from '@/components/property-table';
import { PrintButton } from '@/components/print-button';
import { saveProperty } from '@/lib/actions/property';

export default async function DeptProperty({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!isDeptCode(dept)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('dept_property').select('id, name, qty, price, condition, owner_dept')
    .eq('owner_dept', dept).order('name');
  const isFinance = dept === 'finance';
  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የክፍሉ ንብረት</h2>
        <PrintButton />
      </div>
      {isFinance ? (
        <MediaForm action={saveProperty} submitLabel="+ ንብረት መዝግብ"><PropertyFields fixedDept="finance" /></MediaForm>
      ) : (
        <p className="muted small">ንብረት የሚመዘገበው በጽሕፈት ቤት ነው፤ እዚህ ለማየት ብቻ ነው።</p>
      )}
      <PropertyTable rows={(data ?? []) as PropertyRow[]} editable={isFinance} fixedDept={isFinance ? 'finance' : undefined} />
    </>
  );
}
