import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { PublicHeader } from '@/components/public-header';
import { classLabel, semesterLabel } from '@/lib/education';

export const metadata: Metadata = { title: 'ሰነድ ማረጋገጫ' };

type V = {
  type: 'receipt' | 'voucher' | 'certificate' | 'transcript' | null;
  year?: number; semester?: number; class?: string;
  code?: string; amount?: number; payer?: string; purpose?: string; issued_at?: string; voided?: boolean;
  dept?: string; paid_at?: string; received?: boolean; name?: string; leave_date?: string; approved_at?: string;
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  let v: V | null = null;
  if (c && c.trim()) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('verify_code', { p_code: c });
    v = (data as V) ?? { type: null };
  }
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ሰነድ ማረጋገጫ</h1>
        <p className="muted">በደረሰኝ፣ በወጪ ማዘዣ ፣ በመልቀቂያ ምስክር ወረቀት ወይም በትራንስክሪፕት ላይ ያለውን ቁጥር ያስገቡ (ወይም QR ኮዱን ይቃኙ)።</p>
        <form className="card toolbar" action="/verify">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="c">የሰነድ ቁጥር</label>
            <input id="c" name="c" dir="ltr" defaultValue={c ?? ''} placeholder="ፍጽ-ደ-XXXX-XXXX" required />
          </div>
          <button className="btn">አረጋግጥ</button>
        </form>
        {v && (
          v.type === null ? (
            <p className="alert error" style={{ marginTop: 14 }}>✗ ይህ ቁጥር በሰንበት ትምህርት ቤቱ መዝገብ ውስጥ የለም። ሰነዱ ትክክለኛ አይደለም።</p>
          ) : (
            <div className="card" style={{ marginTop: 14 }}>
              {v.type === 'receipt' && (v.voided
                ? <p className="alert error">✗ ደረሰኝ {v.code} ተሰርዟል — ዋጋ የለውም።</p>
                : <p className="alert ok">✓ ትክክለኛ ደረሰኝ፦ <b>{v.code}</b></p>)}
              {v.type === 'voucher' && <p className="alert ok">✓ ትክክለኛ የወጪ ማዘዣ፦ <b>{v.code}</b></p>}
              {v.type === 'transcript' && <p className="alert ok">✓ ትክክለኛ የትምህርት ማስረጃ (ትራንስክሪፕት)፦ <b>{v.code}</b></p>}
              {v.type === 'certificate' && <p className="alert ok">✓ ትክክለኛ የመልቀቂያ ምስክር ወረቀት፦ <b>{v.code}</b></p>}
              <dl className="doc-rows" style={{ marginTop: 10 }}>
                {v.type === 'receipt' && <>
                  <div><dt>ከ</dt><dd>{v.payer}</dd></div>
                  <div><dt>መጠን</dt><dd>{formatBirr(v.amount)}</dd></div>
                  <div><dt>ቀን</dt><dd>{v.issued_at ? formatEc(v.issued_at) : '—'}</dd></div>
                  <div><dt>ምክንያት</dt><dd>{v.purpose ?? '—'}</dd></div>
                </>}
                {v.type === 'voucher' && <>
                  <div><dt>ለ</dt><dd>{v.dept}</dd></div>
                  <div><dt>መጠን</dt><dd>{formatBirr(v.amount)}</dd></div>
                  <div><dt>የተከፈለበት</dt><dd>{v.paid_at ? formatEc(v.paid_at) : '—'}</dd></div>
                  <div><dt>ተረክቧል</dt><dd>{v.received ? 'አዎ' : 'ገና'}</dd></div>
                </>}
                {v.type === 'transcript' && <>
                  <div><dt>ስም</dt><dd>{v.name}</dd></div>
                  <div><dt>ክፍል</dt><dd>{classLabel(v.class)}</dd></div>
                  <div><dt>ዘመን</dt><dd>{v.year} ዓ.ም · {v.semester ? semesterLabel(v.semester) : ''}</dd></div>
                  <div><dt>የተሰጠበት</dt><dd>{v.issued_at ? formatEc(v.issued_at) : '—'}</dd></div>
                </>}
                {v.type === 'certificate' && <>
                  <div><dt>ስም</dt><dd>{v.name}</dd></div>
                  <div><dt>የለቀቁበት</dt><dd>{v.leave_date ? formatEc(v.leave_date) : '—'}</dd></div>
                  <div><dt>የጸደቀበት</dt><dd>{v.approved_at ? formatEc(v.approved_at) : '—'}</dd></div>
                </>}
              </dl>
            </div>
          )
        )}
      </main>
    </>
  );
}
