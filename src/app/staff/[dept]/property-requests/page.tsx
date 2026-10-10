import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PROPERTY_REQUEST_COLS, PropertyRequestTable, type PropertyRequest } from '@/components/property-requests';

/** ሒሳብና ንብረት: approve what departments bought — approved items join that department's property. */
export default async function PropertyRequests({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'finance') notFound();
  const supabase = await createClient();
  const [{ data: pending }, { data: done }] = await Promise.all([
    supabase.from('property_requests').select(PROPERTY_REQUEST_COLS).eq('status', 'pending').order('created_at'),
    supabase.from('property_requests').select(PROPERTY_REQUEST_COLS).neq('status', 'pending').order('decided_at', { ascending: false }).limit(100),
  ]);
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>አዲስ የተገዛ ንብረት ለማጸደቅ</h2>
      <p className="muted small">
        ክፍላት የገዙትን ንብረት እዚህ ይልካሉ። ሲጸድቅ በዚያ ክፍል ንብረት ውስጥ ይመዘገባል፤ ለኦዲት የክፍላት ገቢ ወጪም “ንብረት በመጨመር” ሆኖ ይቆጠራል።
      </p>
      <PropertyRequestTable rows={(pending ?? []) as PropertyRequest[]} mode="finance" showDept />
      <h3 className="section">የተወሰነባቸው</h3>
      <PropertyRequestTable rows={(done ?? []) as PropertyRequest[]} showDept />
    </>
  );
}
