import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicHeader } from '@/components/public-header';
import { DonateForm, CopyButton } from '@/components/donate-form';
import { QrCode } from '@/components/doc-sheet';

export const metadata: Metadata = { title: 'ለመርዳት' };

export default async function DonatePage() {
  const supabase = await createClient();
  const { data: a } = await supabase.from('donation_accounts').select('account_name, telebirr_number, cbe_account').maybeSingle();
  const accounts = [
    a?.telebirr_number && { label: 'Telebirr', value: a.telebirr_number },
    a?.cbe_account && { label: 'CBE — የኢትዮጵያ ንግድ ባንክ', value: a.cbe_account },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ለመርዳት</h1>
        <p className="muted">
          ስጦታዎ ለሰንበት ትምህርት ቤቱ አገልግሎት ይውላል። ከታች ባሉት የሰንበት ትምህርት ቤቱ ሂሳቦች ይላኩ፤ ከዚያ “ረድቻለሁ” የሚለውን ቅጽ ይሙሉ።
          ሒሳብና ንብረት ካረጋገጠ በኋላ ደረሰኝዎን ከ<b>ቢሮ ቁጥር 10</b> መውሰድ ይችላሉ።
        </p>
        {accounts.length === 0 ? (
          <p className="alert error">የሂሳብ ቁጥሮቹ በቅርቡ ይገለጻሉ።</p>
        ) : (
          <div className="doc-list" style={{ marginBottom: 20 }}>
            {accounts.map((x) => (
              <div key={x.label} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ background: '#fff', padding: 6, borderRadius: 6 }}><QrCode text={x.value} size={88} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <b>{x.label}</b>
                  <span className="doc-code" dir="ltr">{x.value}</span>
                  {a?.account_name && <span className="small muted">{a.account_name}</span>}
                  <CopyButton value={x.value} />
                </div>
              </div>
            ))}
          </div>
        )}
        <h2 className="section">ረድቻለሁ</h2>
        <DonateForm />
        <p className="small" style={{ marginTop: 12 }}>
          ቀደም ብለው ልከዋል? <Link className="link" href="/donate/track">ደረሰኝዎን ይከታተሉ →</Link>
        </p>
      </main>
    </>
  );
}
