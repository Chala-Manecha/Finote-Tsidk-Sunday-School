import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-button';
import { saveShopSettings, markSold, publishSaleItem, unpublishSaleItem } from '@/lib/actions/property';

type S = {
  id: string; name: string; qty: number; sold_qty: number; price: number | null; buy_price: number | null;
  description: string | null; image_path: string | null; image2_path: string | null;
  bought_on: string | null; sold_on: string | null; published: boolean;
};

/** የሽያጭ ዕቃዎች — pick from የተገዙ ዕቃዎች መዝገብ, set a sell price and publish to the public ለመግዛት page. */
export default async function SaleItems({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ v?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'development') notFound();
  const { v } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: shop }] = await Promise.all([
    supabase.from('sale_items').select('id, name, qty, sold_qty, price, buy_price, description, image_path, image2_path, bought_on, sold_on, published').order('created_at', { ascending: false }),
    supabase.from('shop_settings').select('phone, telegram').maybeSingle(),
  ]);
  const rows = (data ?? []) as S[];
  const left = (s: S) => s.qty - s.sold_qty;
  const onSale = rows.filter((s) => s.published && left(s) > 0);
  const waiting = rows.filter((s) => !s.published && left(s) > 0);
  const soldOut = rows.filter((s) => left(s) === 0);
  const view = v === 'waiting' || v === 'sold' || v === 'contact' ? v : 'sale';
  const list = view === 'waiting' ? waiting : view === 'sold' ? soldOut : onSale;
  const revenue = rows.reduce((t, s) => t + s.sold_qty * Number(s.price ?? 0), 0);
  const stockValue = onSale.reduce((t, s) => t + left(s) * Number(s.price ?? 0), 0);
  const img = (s: S) => s.image_path ? mediaUrl(supabase, s.image_path) : s.image2_path ? mediaUrl(supabase, s.image2_path) : null;
  const base = '/staff/development/sale-items';

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የሽያጭ ዕቃዎች</h2>
        <span className="spacer" />
        <Link className="btn sm secondary" href="/shop" target="_blank">🛍 የሕዝብ ገጹን እይ ↗</Link>
      </div>
      <div className="money-tiles slim">
        <div className="mt-in"><span>ለሽያጭ ያሉ</span><b>{onSale.length}</b></div>
        <div className="mt-open"><span>የሚጠብቁ</span><b>{waiting.length}</b></div>
        <div className="mt-bal"><span>በእጅ ያለው (በመሸጫ ዋጋ)</span><b>{formatBirr(stockValue)}</b></div>
        <div className="mt-in"><span>የተሸጠ ገቢ</span><b>{formatBirr(revenue)}</b></div>
      </div>

      <div className="split">
        <aside className="rail no-print" aria-label="ዕቃዎች">
          <div className="rail-title">ዕቃዎች</div>
          <Link href={base} className={view === 'sale' ? 'on' : ''}><span>🛒 ለሽያጭ የወጡ</span><b>{onSale.length}</b></Link>
          <Link href={`${base}?v=waiting`} className={`${view === 'waiting' ? 'on' : ''} ${waiting.length ? 'warn' : ''}`}><span>⏳ ለሽያጭ ያልወጡ</span><b>{waiting.length}</b></Link>
          <Link href={`${base}?v=sold`} className={view === 'sold' ? 'on' : ''}><span>✅ ሙሉ በሙሉ የተሸጡ</span><b>{soldOut.length}</b></Link>
          <div className="rail-title">ማስተካከያ</div>
          <Link href={`${base}?v=contact`} className={view === 'contact' ? 'on' : ''}><span>📞 የመግዣ አድራሻ</span></Link>
          <Link href="/staff/development/purchases"><span>🧾 የተገዙ ዕቃዎች መዝገብ →</span></Link>
        </aside>
        <div className="split-main">
          {view === 'contact' ? (
            <section className="card" style={{ maxWidth: 520 }}>
              <div className="card-head"><b>📞 የመግዣ አድራሻ</b><span className="small muted">በ“ለመግዛት” ገጽ ላይ ይታያል</span></div>
              <MediaForm action={saveShopSettings} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                <div className="field"><label>ስልክ</label><input name="phone" dir="ltr" defaultValue={shop?.phone ?? ''} placeholder="09…" /></div>
                <div className="field"><label>Telegram username</label><input name="telegram" dir="ltr" defaultValue={shop?.telegram ?? ''} placeholder="@username" /></div>
              </MediaForm>
            </section>
          ) : (
            <>
              {view === 'waiting' && <p className="small muted" style={{ marginTop: 0 }}>በ<Link className="link" href="/staff/development/purchases">የተገዙ ዕቃዎች መዝገብ</Link> የተመዘገቡ — የመሸጫ ዋጋ ሰጥተው “ለሽያጭ አውጣ” ይጫኑ።</p>}
              {list.length === 0 ? <p className="muted card">{view === 'waiting' ? 'ለሽያጭ የሚጠብቅ ዕቃ የለም።' : view === 'sold' ? 'ሙሉ በሙሉ የተሸጠ ዕቃ የለም።' : 'ለሽያጭ የወጣ ዕቃ የለም።'}</p> : (
                <div className="shop-admin-grid">
                  {list.map((s) => {
                    const pic = img(s);
                    const l = left(s);
                    return (
                      <article key={s.id} className="shop-admin-card">
                        <div className="sac-img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {pic ? <img src={pic} alt="" /> : <span>🏷</span>}
                          {s.price != null && view !== 'waiting' && <b className="sac-price">{formatBirr(s.price)}</b>}
                        </div>
                        <div className="sac-body">
                          <b>{s.name}</b>
                          {s.description && <span className="small muted sac-desc">{s.description}</span>}
                          <div className="sac-stats small">
                            <span>ብዛት <b>{s.qty}</b></span><span>ተሽጧል <b>{s.sold_qty}</b></span><span>ቀሪ <b className={l ? '' : 'neg'}>{l}</b></span>
                          </div>
                          <div className="small muted">የተገዛበት {s.buy_price == null ? '—' : formatBirr(s.buy_price)}{s.bought_on ? ` · ${formatEc(s.bought_on)}` : ''}{s.sold_on ? ` · የተሸጠ ${formatEc(s.sold_on)}` : ''}</div>
                          <div className="btn-row sac-actions">
                            {view === 'waiting' && (
                              <Modal label="ለሽያጭ አውጣ" title="ለሽያጭ አውጣ" sub={s.name} btnClass="btn sm green" size="sm">
                                <MediaForm action={publishSaleItem} submitLabel="ለሽያጭ አውጣ" card={false}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <div className="field"><label>የመሸጫ ዋጋ (ብር)</label><input name="price" type="number" min={0} step="0.01" required defaultValue={s.price ?? ''} /></div>
                                </MediaForm>
                              </Modal>
                            )}
                            {view === 'sale' && (
                              <>
                                <Modal label="✓ ተሽጧል" title="የተሸጠ ብዛት" sub={s.name} btnClass="btn sm green" size="sm">
                                  <MediaForm action={markSold} submitLabel="አረጋግጥ" card={false}>
                                    <input type="hidden" name="id" value={s.id} />
                                    <div className="field"><label>ብዛት (ቢበዛ {l})</label><input name="sold" type="number" min={1} max={l} step={1} defaultValue={l} /></div>
                                  </MediaForm>
                                </Modal>
                                <Modal label="ዋጋ ቀይር" title="የመሸጫ ዋጋ" sub={s.name} btnClass="btn sm secondary" size="sm">
                                  <MediaForm action={publishSaleItem} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                                    <input type="hidden" name="id" value={s.id} />
                                    <div className="field"><label>የመሸጫ ዋጋ (ብር)</label><input name="price" type="number" min={0} step="0.01" required defaultValue={s.price ?? ''} /></div>
                                  </MediaForm>
                                </Modal>
                                <ActionButton action={unpublishSaleItem.bind(null, s.id)} label="ከሽያጭ አንሳ" className="btn sm secondary" confirmText="ከ“ለመግዛት” ገጽ ይነሳ?" />
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <p className="small muted">የትርፍ ማጠቃለያው በ<Link className="link" href="/staff/development/money">የገንዘብ አስተዳደር</Link> ላይ ይገኛል።</p>
        </div>
      </div>
    </>
  );
}
