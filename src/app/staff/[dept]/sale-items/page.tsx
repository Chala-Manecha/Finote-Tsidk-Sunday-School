import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EARNING_STATUS, STATUS_PILL, formatBirr, type EarningStatus } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { saveSaleItem, deleteSaleItem, saveShopSettings, recordSale } from '@/lib/actions/property';

type S = { id: string; name: string; qty: number; price: number | null; description: string | null; image_path: string | null };
type Sale = { id: string; amount: number; sale_qty: number; status: EarningStatus; earned_on: string; sale_item_id: string };

function Fields({ s }: { s?: S }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="form-grid">
        <div className="field"><label>የዕቃው ስም</label><input name="name" required defaultValue={s?.name} /></div>
        <div className="field"><label>ብዛት</label><input name="qty" type="number" min={0} step={1} required defaultValue={s?.qty ?? 0} /></div>
        <div className="field"><label>የአንዱ ዋጋ (ብር)</label><input name="price" type="number" min={0} step="0.01" defaultValue={s?.price ?? ''} /></div>
        <div className="field">
          <label>ምስል {s?.image_path ? '(ለመቀየር ብቻ)' : ''}</label>
          <input name="image" type="file" accept="image/*" />
        </div>
      </div>
      <div className="field"><label>መግለጫ</label><input name="description" defaultValue={s?.description ?? ''} placeholder="መጠን፣ ቀለም…" /></div>
    </>
  );
}

export default async function SaleItems({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'development') notFound();
  const supabase = await createClient();
  const [{ data }, { data: shop }, { data: salesData }] = await Promise.all([
    supabase.from('sale_items').select('id, name, qty, price, description, image_path').order('name'),
    supabase.from('shop_settings').select('phone, telegram').maybeSingle(),
    supabase.from('earnings').select('id, amount, sale_qty, status, earned_on, sale_item_id')
      .not('sale_item_id', 'is', null).order('created_at', { ascending: false }).limit(30),
  ]);
  const rows = (data ?? []) as S[];
  const sales = (salesData ?? []) as Sale[];
  const nameOf = new Map(rows.map((r) => [r.id, r.name]));

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የሽያጭ ዕቃዎች</h2>
        <Link className="link small" href="/shop" target="_blank">የሕዝብ ገጹን (ለመግዛት) እይ ↗</Link>
      </div>

      <details className="card" style={{ marginBottom: 12 }}>
        <summary><b>የመግዣ አድራሻ</b> <span className="small muted">— በ“ለመግዛት” ገጽ ላይ የሚታይ ስልክ እና Telegram</span></summary>
        <MediaForm action={saveShopSettings} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
          <div className="form-grid">
            <div className="field"><label>ስልክ</label><input name="phone" dir="ltr" defaultValue={shop?.phone ?? ''} placeholder="09…" /></div>
            <div className="field"><label>Telegram username</label><input name="telegram" dir="ltr" defaultValue={shop?.telegram ?? ''} placeholder="@username" /></div>
          </div>
        </MediaForm>
      </details>

      <h3 className="section">ሽያጭ መዝግብ</h3>
      <MediaForm action={recordSale} submitLabel="ሽያጭ መዝግብ">
        <div className="form-grid">
          <div className="field">
            <label>ዕቃ</label>
            <select name="sale_item_id" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {rows.filter((r) => r.qty > 0).map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.qty}{r.price != null ? ` · ${formatBirr(r.price)}` : ''})</option>
              ))}
            </select>
          </div>
          <div className="field"><label>ብዛት</label><input name="sale_qty" type="number" min={1} step={1} defaultValue={1} required /></div>
          <div className="field">
            <label>ጠቅላላ ገንዘብ (ብር)</label>
            <input name="amount" type="number" min={0} step="0.01" placeholder="ባዶ = ዋጋ × ብዛት" />
          </div>
          <div className="field"><span className="label">ቀን (ዓ.ም)</span><EcDatePicker name="earned_on" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={0} required /></div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>ሽያጩ እንደ ገቢ ለሒሳብና ንብረት ይላካል፤ ሲጸድቅ ክምችቱ ይቀንሳል፤ 0 ሲደርስ “ተሽጧል” ይታያል።</p>
      </MediaForm>

      <h3 className="section">ክምችት</h3>
      <MediaForm action={saveSaleItem} submitLabel="+ ዕቃ ጨምር" fileField="image" folder="shop" resize><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ምስል</th><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">ዋጋ</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.image_path ? <img className="thumb" src={mediaUrl(supabase, s.image_path)!} alt="" /> : <span className="muted small">—</span>}</td>
                <td>{s.name}{s.description && <div className="small muted">{s.description}</div>}</td>
                <td className="num">{s.qty === 0 ? <span className="pill absent">ተሽጧል</span> : s.qty}</td>
                <td className="num">{s.price == null ? '—' : formatBirr(s.price)}</td>
                <td>
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 300 }}>
                        <MediaForm action={saveSaleItem} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false} fileField="image" folder="shop" resize><Fields s={s} /></MediaForm>
                      </div>
                    </details>
                    <ActionButton action={deleteSaleItem.bind(null, s.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">ምንም ዕቃ የለም።</td></tr>}
          </tbody>
        </table>
      </div>

      {sales.length > 0 && (
        <>
          <h3 className="section">የቅርብ ሽያጮች</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ቀን</th><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">ገንዘብ</th><th>ሁኔታ</th></tr></thead>
              <tbody>
                {sales.map((x) => (
                  <tr key={x.id}>
                    <td>{formatEc(x.earned_on)}</td>
                    <td>{nameOf.get(x.sale_item_id) ?? '—'}</td>
                    <td className="num">{x.sale_qty}</td>
                    <td className="num">{formatBirr(x.amount)}</td>
                    <td><span className={`pill ${STATUS_PILL[x.status]}`}>{EARNING_STATUS[x.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
