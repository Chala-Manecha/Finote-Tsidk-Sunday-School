import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { mediaUrl } from '@/lib/media';
import { PublicHeader } from '@/components/public-header';

export const metadata: Metadata = { title: 'ለመግዛት' };

type S = { id: string; name: string; qty: number; price: number | null; description: string | null; image_path: string | null };

export default async function ShopPage() {
  const supabase = await createClient();
  const [{ data }, { data: shop }] = await Promise.all([
    supabase.from('sale_items').select('id, name, qty, price, description, image_path').order('qty', { ascending: false }).order('name'),
    supabase.from('shop_settings').select('phone, telegram').maybeSingle(),
  ]);
  const items = (data ?? []) as S[];
  const tg = shop?.telegram ? `https://t.me/${shop.telegram}` : null;

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ለመግዛት</h1>
        <p className="muted">በልማትና በጎ አድራጎት ክፍል የሚሸጡ ዕቃዎች። ገቢው ለሰንበት ትምህርት ቤቱ አገልግሎት ይውላል።</p>
        {(tg || shop?.phone) && (
          <div className="shop-contact">
            {tg && <a className="btn telegram" href={tg} target="_blank" rel="noopener noreferrer">Telegram ላይ ይዘዙ</a>}
            {shop?.phone && <a className="btn secondary" href={`tel:${shop.phone.replace(/\s/g, '')}`} dir="ltr">☎ {shop.phone}</a>}
          </div>
        )}
        <div className="shop-grid">
          {items.map((s) => {
            const sold = s.qty <= 0;
            const img = mediaUrl(supabase, s.image_path);
            return (
              <article key={s.id} className={`shop-card ${sold ? 'sold' : ''}`}>
                <div className="shop-img">
                  {img ? (
                    <a href={img} target="_blank" rel="noopener noreferrer" title="ለማየት"><img src={img} alt={s.name} loading="lazy" /></a>
                  ) : <span className="muted small">ምስል የለም</span>}
                  {sold && <span className="sold-badge">ተሽጧል</span>}
                </div>
                <div className="shop-body">
                  <b>{s.name}</b>
                  {s.description && <span className="small muted">{s.description}</span>}
                  <span className="price">{s.price == null ? 'ዋጋ ይጠይቁ' : formatBirr(s.price)}</span>
                  {!sold && <span className="small muted">በክምችት፦ {s.qty}</span>}
                  {!sold && tg && (
                    <a className="btn sm telegram" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} href={tg} target="_blank" rel="noopener noreferrer">
                      Telegram ላይ ይዘዙ
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {items.length === 0 && <p className="muted">በአሁኑ ጊዜ የሚሸጥ ዕቃ የለም።</p>}
      </main>
    </>
  );
}
