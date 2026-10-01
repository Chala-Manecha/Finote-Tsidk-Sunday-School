import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PublicHeader } from '@/components/public-header';

export const metadata: Metadata = { title: 'ደረሰኝዎን ይከታተሉ' };

const MESSAGE: Record<string, { cls: string; text: string }> = {
  pending: { cls: 'half', text: 'ሒሳብና ንብረት ገንዘቡ መግባቱን እያረጋገጠ ነው። እባክዎ ቆይተው ይመልከቱ።' },
  ready: { cls: 'ok', text: 'ተረጋግጧል። እግዚአብሔር ይስጥልን! ደረሰኝዎ ዝግጁ ነው — ከቢሮ ቁጥር 10 ይውሰዱ።' },
  rejected: { cls: 'error', text: 'ገንዘቡ በሂሳባችን ላይ አልተገኘም። እባክዎ ቢሮ ቁጥር 10 ይምጡ ወይም የግብይት ቁጥሩን ያረጋግጡ።' },
  voided: { cls: 'error', text: 'ደረሰኙ ተሰርዟል። እባክዎ ቢሮ ቁጥር 10 ያነጋግሩ።' },
  not_found: { cls: 'error', text: 'በዚህ የግብይት ቁጥር የተመዘገበ እርዳታ የለም። በ“ለመርዳት” ገጽ ላይ ቅጹን ይሙሉ።' },
};

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  let status: string | null = null;
  if (t && t.trim()) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('donation_status', { p_txn: t });
    status = (data as string) ?? 'not_found';
  }
  const m = status ? MESSAGE[status] ?? MESSAGE.not_found : null;
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ደረሰኝዎን ይከታተሉ</h1>
        <form className="card toolbar" action="/donate/track">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="t">የግብይት ቁጥር (Transaction ID)</label>
            <input id="t" name="t" dir="ltr" defaultValue={t ?? ''} required />
          </div>
          <button className="btn">ፈልግ</button>
        </form>
        {m && <p className={`alert ${m.cls === 'ok' ? 'ok' : m.cls === 'half' ? '' : 'error'}`} style={{ marginTop: 14 }}>{m.text}</p>}
      </main>
    </>
  );
}
