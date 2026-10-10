import type { SupabaseClient } from '@supabase/supabase-js';
import { formatBirr } from '@/lib/constants';

/** Current school balance (opening + approved ገቢ + donations − paid ወጪ + returns). */
export async function BalanceCard({ supabase, note }: { supabase: SupabaseClient; note?: string }) {
  const { data } = await supabase.rpc('wallet_balance');
  const bal = Number(data ?? 0);
  return (
    <div className={`balance-card ${bal <= 0 ? 'empty' : ''}`}>
      <span>ያለው ቀሪ ሂሳብ</span>
      <b>{formatBirr(bal)}</b>
      {note && <small>{note}</small>}
    </div>
  );
}
