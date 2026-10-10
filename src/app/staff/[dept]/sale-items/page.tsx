import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveShopSettings, markSold, publishSaleItem, unpublishSaleItem } from '@/lib/actions/property';

type S = {
  id: string; name: string; qty: number; sold_qty: number; price: number | null; buy_price: number | null;
  description: string | null; image_path: string | null; image2_path: string | null;
  bought_on: string | null; sold_on: string | null; published: boolean;
};

/** የሽያጭ ዕቃዎች — pick from የተገዙ ዕቃዎች መዝገብ, set a sell price and publish to the public ለመግዛት page. */
export default async function SaleItems({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'development') notFound();
  const supabase = await createClient();
  const [{ data }, { data: shop }] = await Promise.all([
    supabase.from('sale_items').select('id, name, qty, sold_qty, price, buy_price, description, image_path, image2_path, bought_on, sold_on, published').order('created_at', { ascending: false }),
    supabase.from('shop_settings').select('phone, telegram').maybeSingle(),
  ]);
  const rows = (data ?? []) as S[];
  const published = rows.filter((s) => s.published);
  const waiting = rows.filter((s) => !s.published && s.qty - s.sold_qty > 0);
  const thumbs = (s: S) => (
    <div className="thumbs">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {[s.image_path, s.image2_path].filter(Boolean).map((p) => <img key={p} className="thumb" src={mediaUrl(supabase, p)!} alt="" />)}
      {!s.image_path && !s.image2_path && <span className="muted small">—</span>}
    </div>
  );

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

      <h3 className="section">ለሽያጭ ያልወጡ ዕቃዎች</h3>
      <p className="small muted">
        ዕቃዎች በ<Link className="link" href="/staff/development/purchases">የተገዙ ዕቃዎች መዝገብ</Link> ይመዘገባሉ፤ እዚህ የመሸጫ ዋጋ ሰጥተው ለሽያጭ ያውጧቸው።
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ምስል</th><th>ዕቃ</th><th className="num">ቀሪ</th><th className="num">የተገዛበት</th><th>ለሽያጭ አውጣ</th></tr></thead>
          <tbody>
            {waiting.map((s) => (
              <tr key={s.id}>
                <td>{thumbs(s)}</td>
                <td>{s.name}{s.description && <div className="small muted">{s.description}</div>}</td>
                <td className="num">{s.qty - s.sold_qty}</td>
                <td className="num">{s.buy_price == null ? '—' : formatBirr(s.buy_price)}</td>
                <td>
                  <MediaForm action={publishSaleItem} submitLabel="ለሽያጭ አውጣ" card={false}>
                    <input type="hidden" name="id" value={s.id} />
                    <input name="price" type="number" min={0} step="0.01" required defaultValue={s.price ?? ''} placeholder="የመሸጫ ዋጋ (ብር)" aria-label="የመሸጫ ዋጋ" style={{ width: 150 }} />
                  </MediaForm>
                </td>
              </tr>
            ))}
            {waiting.length === 0 && <tr><td colSpan={5} className="muted">ለሽያጭ የሚጠብቅ ዕቃ የለም።</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="section">ለሽያጭ የወጡ ዕቃዎች</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ምስል</th><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">የሚሸጥበት</th><th>ቀናት</th><th /></tr></thead>
          <tbody>
            {published.map((s) => {
              const left = s.qty - s.sold_qty;
              return (
                <tr key={s.id}>
                  <td>{thumbs(s)}</td>
                  <td>{s.name}{s.description && <div className="small muted">{s.description}</div>}</td>
                  <td className="num">
                    {s.qty}
                    <div className="small">{left === 0 ? <span className="pill absent">ሁሉም ተሽጧል</span> : `ተሽጧል ${s.sold_qty} · ቀሪ ${left}`}</div>
                  </td>
                  <td className="num">{s.price == null ? '—' : formatBirr(s.price)}</td>
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
                        <summary className="btn sm secondary">ዋጋ ቀይር</summary>
                        <div style={{ marginTop: 6 }}>
                          <MediaForm action={publishSaleItem} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                            <input type="hidden" name="id" value={s.id} />
                            <input name="price" type="number" min={0} step="0.01" required defaultValue={s.price ?? ''} aria-label="የመሸጫ ዋጋ" style={{ width: 120 }} />
                          </MediaForm>
                        </div>
                      </details>
                      {left > 0 && <ActionButton action={unpublishSaleItem.bind(null, s.id)} label="ከሽያጭ አንሳ" className="btn sm secondary" confirmText="ከ“ለመግዛት” ገጽ ይነሳ?" />}
                    </div>
                  </td>
                </tr>
              );
            })}
            {published.length === 0 && <tr><td colSpan={6} className="muted">ለሽያጭ የወጣ ዕቃ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">የትርፍ ማጠቃለያው (የታሰበ/የተገኘ ትርፍ) በ<Link className="link" href="/staff/development/money">የገንዘብ አስተዳደር</Link> ላይ ይገኛል።</p>
    </>
  );
}
