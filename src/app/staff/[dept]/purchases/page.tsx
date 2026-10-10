import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { saveSaleItem, deleteSaleItem } from '@/lib/actions/property';

type P = {
  id: string; name: string; qty: number; sold_qty: number; buy_price: number | null; description: string | null;
  image_path: string | null; image2_path: string | null; bought_on: string | null; published: boolean;
};

function Fields({ p }: { p?: P }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form-grid">
        <div className="field"><label>የዕቃው ስም</label><input name="name" required defaultValue={p?.name} /></div>
        <div className="field"><label>ብዛት</label><input name="qty" type="number" min={1} step={1} required defaultValue={p?.qty ?? 1} /></div>
        <div className="field"><label>የተገዛበት ዋጋ (የአንዱ፣ ብር)</label><input name="buy_price" type="number" min={0} step="0.01" required defaultValue={p?.buy_price ?? ''} /></div>
        <div className="field"><span className="label">የተገዛበት ቀን (ዓ.ም)</span><EcDatePicker name="bought_on" defaultIso={p?.bought_on ?? todayIsoAddis()} yearsBack={2} yearsForward={0} required /></div>
        <div className="field"><label>ምስል 1 {p?.image_path ? '(ለመቀየር ብቻ)' : ''}</label><input name="image" type="file" accept="image/*" /></div>
        <div className="field">
          <label>ምስል 2 (አማራጭ) {p?.image2_path ? '(ለመቀየር ብቻ)' : ''}</label>
          <input name="image2" type="file" accept="image/*" />
          {p?.image2_path && <label className="check" style={{ margin: 0 }}><input type="checkbox" name="remove_image2" /> ሁለተኛውን ምስል አጥፋ</label>}
        </div>
      </div>
      <div className="field"><label>ዝርዝር መግለጫ</label><textarea name="description" rows={2} defaultValue={p?.description ?? ''} placeholder="መጠን፣ ቀለም፣ ከየት እንደተገዛ…" /></div>
    </>
  );
}

/** ልማትና በጎ አድራጎት: everything bought, with its details. Items are put on sale from የሽያጭ ዕቃዎች. */
export default async function Purchases({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'development') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('sale_items')
    .select('id, name, qty, sold_qty, buy_price, description, image_path, image2_path, bought_on, published')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as P[];

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የተገዙ ዕቃዎች መዝገብ</h2>
      <p className="muted small">የተገዛውን ዕቃ ዝርዝር እዚህ ይመዝግቡ። ለሽያጭ የሚወጣው በ“የሽያጭ ዕቃዎች” ላይ የመሸጫ ዋጋ ሲሰጠው ነው።</p>
      <MediaForm action={saveSaleItem} submitLabel="+ መዝግብ" fileField={['image', 'image2']} folder="shop" resize><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ምስል</th><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">የተገዛበት</th><th>ቀን</th><th>ሽያጭ</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><div className="thumbs">{[p.image_path, p.image2_path].filter(Boolean).map((x) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={x} className="thumb" src={mediaUrl(supabase, x)!} alt="" />
                ))}</div></td>
                <td>{p.name}{p.description && <div className="small muted">{p.description}</div>}</td>
                <td className="num">{p.qty}</td>
                <td className="num">{p.buy_price == null ? '—' : formatBirr(p.buy_price)}</td>
                <td className="small">{p.bought_on ? formatEc(p.bought_on) : '—'}</td>
                <td>{p.published ? <span className="pill present">ለሽያጭ ወጥቷል</span> : <span className="pill">በመዝገብ ብቻ</span>}</td>
                <td>
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 300 }}>
                        <MediaForm action={saveSaleItem} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false} fileField={['image', 'image2']} folder="shop" resize><Fields p={p} /></MediaForm>
                      </div>
                    </details>
                    {p.sold_qty === 0 && <ActionButton action={deleteSaleItem.bind(null, p.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">ምንም አልተመዘገበም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
