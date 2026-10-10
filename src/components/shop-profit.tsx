import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatBirr } from '@/lib/constants';

const SHOP_SOURCE = 'የሱቅ ሽያጭ';

/** ልማትና በጎ አድራጎት › የገንዘብ አስተዳደር: shop profit and what is still to be reported as ገቢ. */
export async function ShopProfit({ supabase }: { supabase: SupabaseClient }) {
  const [{ data }, { data: reports }] = await Promise.all([
    supabase.from('sale_items').select('qty, sold_qty, price, buy_price'),
    supabase.from('earnings').select('amount').eq('dept', 'development').eq('source', SHOP_SOURCE).neq('status', 'rejected'),
  ]);
  const unit = (s: { price: number | null; buy_price: number | null }) => Number(s.price ?? 0) - Number(s.buy_price ?? 0);
  const rows = (data ?? []).filter((s) => s.price !== null);
  const expected = rows.reduce((t, s) => t + s.qty * unit(s), 0);
  const earned = rows.reduce((t, s) => t + s.sold_qty * unit(s), 0);
  const reported = (reports ?? []).reduce((t, r) => t + Number(r.amount), 0);
  const toReport = Math.max(Math.round((earned - reported) * 100) / 100, 0);
  const href = `/staff/development/money?view=earn&amount=${toReport}&source=${encodeURIComponent(SHOP_SOURCE)}`;
  return (
    <section style={{ marginBottom: 14 }}>
      <div className="stat-cards">
        <div className="stat-card"><b>{formatBirr(expected)}</b>የታሰበ ትርፍ</div>
        <div className="stat-card"><b className="pos">{formatBirr(earned)}</b>የተገኘ ትርፍ</div>
        <div className="stat-card"><b>{formatBirr(reported)}</b>ሪፖርት የተደረገ</div>
        <div className="stat-card"><b>{formatBirr(toReport)}</b>ሪፖርት ያልተደረገ</div>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        {toReport > 0
          ? <Link className="btn green" href={href}>ገቢ ሪፖርት ({formatBirr(toReport)})</Link>
          : <span className="small muted">ሪፖርት የሚደረግ አዲስ የሱቅ ትርፍ የለም።</span>}
      </div>
      <p className="small muted">የታሰበ ትርፍ = (የመሸጫ − የተገዛበት) × ብዛት · የተገኘ ትርፍ = (የመሸጫ − የተገዛበት) × የተሸጠ ብዛት</p>
    </section>
  );
}
