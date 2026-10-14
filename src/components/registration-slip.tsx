'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CHURCH_NAME, SCHOOL_ADDRESS, SCHOOL_NAME } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';

export type SlipSection = { title: string; rows: [string, string][] };
export type SlipData = { sections: SlipSection[]; photo: string | null; fullName: string };

/** የአባልነት ማረጋገጫ ምስክር ወረቀት — printed by የሰው ሃብት አስተዳደር once the member is approved. QR → the public verify page. */
export function RegistrationSlip({ slip, regNo, qrUrl, registeredIso }: { slip: SlipData; regNo: string; qrUrl: string; registeredIso?: string | null }) {
  const [qr, setQr] = useState<string>('');
  useEffect(() => {
    const url = qrUrl.startsWith('/') ? `${window.location.origin}${qrUrl}` : qrUrl;
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [qrUrl]);

  return (
    <article className="doc-sheet slip">
      <h1 className="slip-main-title">የአባልነት ማረጋገጫ ምስክር ወረቀት</h1>
      <header className="slip-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={74} height={74} />
        <div>
          <div className="small">{CHURCH_NAME}</div>
          <div className="doc-org">{SCHOOL_NAME}</div>
          <div className="small muted">{SCHOOL_ADDRESS}</div>
        </div>
        <div className="slip-title">
          <div className="small muted">የምዝገባ ቁጥር</div>
          <div className="doc-code">{regNo}</div>
          <div className="small muted">የምዝገባ ቀን፦ {formatEc(registeredIso ?? todayIsoAddis())}</div>
        </div>
      </header>

      <div className="slip-top">
        {slip.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="cert-photo" src={slip.photo} alt="" />
          : <div className="cert-photo" />}
        <div className="slip-note">
          <b>{slip.fullName}</b>
        </div>
        {qr && <div className="doc-qr" style={{ width: 96, height: 96 }} dangerouslySetInnerHTML={{ __html: qr }} />}
      </div>

      {slip.sections.filter((s) => s.rows.length).map((s) => (
        <section key={s.title} className="slip-sec">
          <h3>{s.title}</h3>
          <dl className="doc-rows">
            {s.rows.map(([k, v], i) => <div key={`${k}-${i}`}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
          </dl>
        </section>
      ))}

      <div className="statement-signs">
        <div><div className="sign-line" />የአባሉ ፊርማ</div>
        <div><div className="sign-line" />ያጸደቀው (የሰው ሃብት አስተዳደር) ስምና ፊርማ</div>
      </div>
      <p className="slip-thanks">በሰንበት ትምህርት ቤታችን ስለተመዘገቡ እናመሰግናለን። እግዚአብሔር ይጠብቅልን።</p>
    </article>
  );
}
