import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { saveSaleItem, deleteSaleItem, saveShopSettings, markSold } from '@/lib/actions/property';

type S = {
  id: string; name: string; qty: number; sold_qty: number; price: number | null; buy_price: number | null;
  description: string | null; image_path: string | null; image2_path: string | null; bought_on: string | null; sold_on: string | null;
};
const SHOP_SOURCE = 'የሱቅ ሽያጭ';

const unitProfit = (s: S) => Number(s.price ?? 0) - Number(s.buy_price ?? 0);

function Fields({ s }: { s?: S }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="form-grid">
        <div className="field"><label>የዕቃው ስም</label><input name="name" required defaultValue={s?.name} /></div>
        <div className="field"><label>ብዛት</label><input name="qty" type="number" min={1} step={1} required defaultValue={s?.qty ?? 1} /></div>
        <div className="field"><label>የተገዛበት ዋጋ (የአንዱ፣ ብር)</label><input name="buy_price" type="number" min={0} step="0.01" required defaultValue={s?.buy_price ?? ''} /></div>
        <div className="field"><label>የመሸጫ ዋጋ (የአንዱ፣ ብር)</label><input name="price" type="number" min={0} step="0.01" required defaultValue={s?.price ?? ''} /></div>
        <div className="field"><span className="label">የተገዛበት ቀን (ዓ.ም)</span><EcDatePicker name="bought_on" defaultIso={s?.bought_on ?? todayIsoAddis()} yearsBack={2} yearsForward={0} required /></div>
        <div className="field">
          <label>ምስል 1 {s?.image_path ? '(ለመቀየር ብቻ)' : ''}</label>
          <input name="image" type="file" accept="image/*" />
        </div>
        <div className="field">
          <label>ምስል 2 (አማራጭ) {s?.image2_path ? '(ለመቀየር ብቻ)' : ''}</label>
          <input name="image2" type="file" accept="image/*" />
          {s?.image2_path && <label className="check" style={{ margin: 0 }}><input type="checkbox" name="remove_image2" /> ሁለተኛውን ምስል አጥፋ</label>}
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
  const [{ data }, { data: shop }, { data: reports }] = await Promise.all([
    supabase.from('sale_items').select('id, name, qty, sold_qty, price, buy_price, description, image_path, image2_path, bought_on, sold_on').order('created_at', { ascending: false }),
    supabase.from('shop_settings').select('phone, telegram').maybeSingle(),
    supabase.from('earnings').select('amount, status').eq('dept', 'development').eq('source', SHOP_SOURCE).neq('status', 'rejected'),
  ]);
  const rows = (data ?? []) as S[];
  const expected = rows.reduce((t, s) => t + s.qty * unitProfit(s), 0);
  const earned = rows.reduce((t, s) => t + s.sold_qty * unitProfit(s), 0);
  const reported = (reports ?? []).reduce((t, r) => t + Number(r.amount), 0);
  const toReport = Math.max(Math.round((earned - reported) * 100) / 100, 0);
  const reportHref = `/staff/development/money?view=earn&amount=${toReport}&source=${encodeURIComponent(SHOP_SOURCE)}`;

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የሽያጭ ዕቃዎች</h2>
        <Link className="link small" href="/shop" target="_blank">የሕዝብ ገጹን (ለመግዛት) እይ ↗</Link>
      </div>

      <div className="stat-cards">
        <div className="stat-card"><b>{formatBirr(expected)}</b>የታሰበ ትርፍ</div>
        <div className="stat-card"><b className="pos">{formatBirr(earned)}</b>የተገኘ ትርፍ</div>
        <div className="stat-card"><b>{formatBirr(reported)}</b>ሪፖርት የተደረገ</div>
        <div className="stat-card"><b>{formatBirr(toReport)}</b>ሪፖርት ያልተደረገ</div>
      </div>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        {toReport > 0
          ? <Link className="btn green" href={reportHref}>ገቢ ሪፖርት ({formatBirr(toReport)})</Link>
          : <span className="small muted">ሪፖርት የሚደረግ አዲስ ትርፍ የለም።</span>}
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

      <h3 className="section">ክምችት — የተገዙ ዕቃዎችን መዝግብ</h3>
      <MediaForm action={saveSaleItem} submitLabel="+ መዝግብ" fileField={['image', 'image2']} folder="shop" resize><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ምስል</th><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">የተገዛበት</th><th className="num">የሚሸጥበት</th>
              <th className="num">የታሰበ ትርፍ</th><th className="num">የተገኘ ትርፍ</th><th>ቀናት</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const left = s.qty - s.sold_qty;
              return (
                <tr key={s.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td><div className="thumbs">{[s.image_path, s.image2_path].filter(Boolean).map((p) => <img key={p} className="thumb" src={mediaUrl(supabase, p)!} alt="" />)}{!s.image_path && !s.image2_path && <span className="muted small">—</span>}</div></td>
                  <td>{s.name}{s.description && <div className="small muted">{s.description}</div>}</td>
                  <td className="num">
                    {s.qty}
                    <div className="small">{left === 0 ? <span className="pill absent">ሁሉም ተሽጧል</span> : `ተሽጧል ${s.sold_qty} · ቀሪ ${left}`}</div>
                  </td>
                  <td className="num">{s.buy_price == null ? '—' : formatBirr(s.buy_price)}</td>
                  <td className="num">{s.price == null ? '—' : formatBirr(s.price)}</td>
                  <td className="num">{formatBirr(s.qty * unitProfit(s))}</td>
                  <td className="num pos">{formatBirr(s.sold_qty * unitProfit(s))}</td>
                  <td className="small">
                    {s.bought_on && <div>የተገዛ፦ {formatEc(s.bought_on)}</div>}
                    {s.sold_on && <div>የተሸጠ፦ {formatEc(s.sold_on)}</div>}
                  </td>
                  <td>
                    <div className="btn-row">
                      {left > 0 && (
                        <details>
                          <summary className="btn sm green">ተሽጧል</summary>
                          <div style={{ marginTop: 6 }}>
                            <MediaForm action={markSold} submitLabel="አረጋግጥ" card={false}>
                              <input type="hidden" name="id" value={s.id} />
                              <input name="sold" type="number" min={1} max={left} step={1} defaultValue={left} aria-label="የተሸጠ ብዛት" style={{ width: 80 }} />
                            </MediaForm>
                          </div>
                        </details>
                      )}
                      <details>
                        <summary className="btn sm secondary">አርም</summary>
                        <div style={{ marginTop: 8, minWidth: 300 }}>
                          <MediaForm action={saveSaleItem} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false} fileField={['image', 'image2']} folder="shop" resize><Fields s={s} /></MediaForm>
                        </div>
                      </details>
                      {s.sold_qty === 0 && <ActionButton action={deleteSaleItem.bind(null, s.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9} className="muted">ምንም ዕቃ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">የታሰበ ትርፍ = (የመሸጫ − የተገዛበት) × ብዛት · የተገኘ ትርፍ = (የመሸጫ − የተገዛበት) × የተሸጠ ብዛት</p>
    </>
  );
}
