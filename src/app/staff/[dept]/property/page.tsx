import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { PROPERTY_COLS, PropertyFields, PropertyTable, type PropertyRow } from '@/components/property-table';
import { PROPERTY_REQUEST_COLS, PropertyRequestTable, type PropertyRequest } from '@/components/property-requests';
import { PrintButton } from '@/components/print-button';
import { saveProperty, requestProperty } from '@/lib/actions/property';
import { Modal } from '@/components/modal';

/** የክፍሉ ንብረት: ሒሳብና ንብረት registers its own; every other department sends what it bought for approval. */
export default async function DeptProperty({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!isDeptCode(dept)) notFound();
  const supabase = await createClient();
  const isFinance = dept === 'finance';
  const [{ data }, { data: reqs }] = await Promise.all([
    supabase.from('dept_property').select(PROPERTY_COLS).eq('owner_dept', dept).order('name'),
    isFinance ? Promise.resolve({ data: [] }) :
      supabase.from('property_requests').select(PROPERTY_REQUEST_COLS).eq('dept', dept).order('created_at', { ascending: false }).limit(50),
  ]);
  const requests = (reqs ?? []) as PropertyRequest[];
  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የክፍሉ ንብረት</h2>
        <span className="count-badge">{(data ?? []).length}</span>
        <span className="spacer" />
        <PrintButton />
        {isFinance ? (
          <Modal label="+ ንብረት መዝግብ" title="ንብረት መዝግብ" size="lg">
            <MediaForm action={saveProperty} submitLabel="+ ንብረት መዝግብ" card={false}><PropertyFields fixedDept="finance" source="inherited" /></MediaForm>
          </Modal>
        ) : (
          <Modal label="+ አዲስ የተገዛ ንብረት" title="አዲስ የተገዛ ንብረት ለማጸደቅ" sub="ሒሳብና ንብረት ሲያጸድቀው በክፍሉ ንብረት ውስጥ ይመዘገባል" size="lg">
            <MediaForm action={requestProperty} submitLabel="ለማጸደቅ ላክ" card={false}>
              <PropertyFields fixedDept={dept} defaultSource="አዲስ በክፍሉ የገዛ" />
            </MediaForm>
          </Modal>
        )}
      </div>
      {requests.length > 0 && (
        <>
          <h3 className="section no-print">ለማጸደቅ የተላኩ</h3>
          <div className="no-print"><PropertyRequestTable rows={requests} mode="dept" /></div>
        </>
      )}
      <h3 className="section">የተመዘገበ ንብረት</h3>
      <PropertyTable rows={(data ?? []) as PropertyRow[]} editable={isFinance} fixedDept={isFinance ? 'finance' : undefined} />
    </>
  );
}
