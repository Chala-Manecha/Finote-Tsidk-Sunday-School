'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CHURCH_NAME, SCHOOL_ADDRESS, SCHOOL_NAME } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';

export type SlipSection = { title: string; rows: [string, string][] };
export type SlipData = { sections: SlipSection[]; photo: string | null; fullName: string };

/**
 * የአባልነት ማረጋገጫ ምስክር ወረቀት — a formal certificate (framed, centred letterhead, statement, then the
 * member's details as label: value lines). Empty fields and empty sections are left out.
 * QR (→ the public verify page) sits at the bottom right, under the signatures.
 */
export function RegistrationSlip({ slip, regNo, qrUrl, registeredIso }: { slip: SlipData; regNo: string; qrUrl: string; registeredIso?: string | null }) {
  const [qr, setQr] = useState<string>('');
  useEffect(() => {
    const url = qrUrl.startsWith('/') ? `${window.location.origin}${qrUrl}` : qrUrl;
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [qrUrl]);

  const date = formatEc(registeredIso ?? todayIsoAddis());
  const sections = slip.sections
    .map((s) => ({ ...s, rows: s.rows.filter(([, v]) => v && v.trim() && v.trim() !== '—') }))
    .filter((s) => s.rows.length);

  return (
    <article className="doc-sheet fcert">
      <div className="fcert-frame">
        <header className="fcert-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={68} height={68} />
          <div className="fcert-church">{CHURCH_NAME}</div>
          <div className="fcert-school serif">{SCHOOL_NAME}</div>
          <div className="fcert-addr">{SCHOOL_ADDRESS}</div>
        </header>

        <h1 className="fcert-title serif">የአባልነት ማረጋገጫ ምስክር ወረቀት</h1>
        <div className="fcert-meta">
          <span>የምዝገባ ቁጥር፦ <b className="doc-code">{regNo}</b></span>
          <span>የምዝገባ ቀን፦ <b>{date}</b></span>
        </div>

        <div className="fcert-intro">
          <div>
            <p className="fcert-lead">ይህ የምስክር ወረቀት</p>
            <p className="fcert-name serif">{slip.fullName}</p>
            <p className="fcert-text">
              በ{date} በ{SCHOOL_NAME} በአባልነት የተመዘገቡ መሆናቸውን ያረጋግጣል። ከዚህ በታች የተዘረዘረው መረጃ
              በምዝገባ ቅጻቸው ላይ የሰጡት ሲሆን በሰው ሃብት አስተዳደር ክፍል ተረጋግጧል።
            </p>
          </div>
          {slip.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="fcert-photo" src={slip.photo} alt="" />
            : <div className="fcert-photo empty">ፎቶ</div>}
        </div>

        {sections.map((s) => (
          <section key={s.title} className="fcert-sec">
            <h3><span>{s.title}</span></h3>
            <dl className="fcert-fields">
              {s.rows.map(([k, v], i) => (
                <div key={`${k}-${i}`} className={v.length > 46 ? 'wide' : ''}>
                  <dt>{k}፦</dt><dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <div className="fcert-signs">
          <div><div className="sign-line" /><b>የአባሉ ፊርማ</b></div>
          <div><div className="sign-line" /><b>ያጸደቀው</b><span>የሰው ሃብት አስተዳደር · ስምና ፊርማ</span></div>
          <div className="fcert-stamp">ማኅተም</div>
        </div>

        <footer className="fcert-foot">
          <p>በሰንበት ትምህርት ቤታችን ስለተመዘገቡ እናመሰግናለን። እግዚአብሔር ይጠብቅልን።</p>
          <div className="fcert-qr">
            {qr && <div className="doc-qr" dangerouslySetInnerHTML={{ __html: qr }} />}
            <span>ትክክለኛነቱን ያረጋግጡ</span>
          </div>
        </footer>
      </div>
    </article>
  );
}
