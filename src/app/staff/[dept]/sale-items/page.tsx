import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveSaleItem, deleteSaleItem } from '@/lib/actions/property';

type S = { id: string; name: string; qty: number; price: number | null };

function Fields({ s }: { s?: S }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="form-grid">
        <div className="field"><label>የዕቃው ስም</label><input name="name" required defaultValue={s?.name} /></div>
        <div className="field"><label>ብዛት</label><input name="qty" type="number" min={0} step={1} required defaultValue={s?.qty ?? 0} /></div>
        <div className="field"><label>የመሸጫ ዋጋ (ብር)</label><input name="price" type="number" min={0} step="0.01" defaultValue={s?.price ?? ''} /></div>
      </div>
    </>
  );
}

export default async function SaleItems({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'development') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('sale_items').select('id, name, qty, price').order('name');
  const rows = (data ?? []) as S[];
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የሽያጭ ዕቃዎች</h2>
      <MediaForm action={saveSaleItem} submitLabel="+ ዕቃ ጨምር"><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">ዋጋ</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="num">{s.qty === 0 ? <span className="pill absent">አልቋል</span> : s.qty}</td>
                <td className="num">{s.price == null ? '—' : formatBirr(s.price)}</td>
                <td>
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 300 }}>
                        <MediaForm action={saveSaleItem} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}><Fields s={s} /></MediaForm>
                      </div>
                    </details>
                    <ActionButton action={deleteSaleItem.bind(null, s.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">ምንም ዕቃ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
