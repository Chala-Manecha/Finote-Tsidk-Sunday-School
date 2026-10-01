import QRCode from 'qrcode';
import { headers } from 'next/headers';
import { SCHOOL_NAME, CHURCH_NAME, SCHOOL_ADDRESS } from '@/lib/constants';
import { anniversaryYear } from './brand';

/** Absolute link to the public verify page for a printed code. */
export async function verifyUrl(code: string) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'finote-tsidk-sunday-school.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}/verify?c=${encodeURIComponent(code)}`;
}

export async function QrCode({ text, size = 104 }: { text: string; size?: number }) {
  const svg = await QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  return <div className="doc-qr" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Letterhead used on receipts, vouchers and certificates. */
export function DocHeader({ title, code, mark }: { title: string; code: string; mark?: string | null }) {
  return (
    <header className="doc-head">
      <div>
        <div className="doc-org serif">{SCHOOL_NAME}</div>
        <div className="small">{CHURCH_NAME}</div>
        <div className="small muted">{SCHOOL_ADDRESS} · {anniversaryYear()}ኛ ምሥረታ አመት</div>
      </div>
      <div className="doc-title">
        <h1 className="serif">{title}</h1>
        <div className="doc-code">{code}</div>
        {mark && <div className="doc-mark">{mark}</div>}
      </div>
    </header>
  );
}

export function DocRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="doc-rows">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

export function DocSigns({ roles }: { roles: string[] }) {
  return (
    <div className="statement-signs">
      {roles.map((r) => (
        <div key={r}>
          <div className="sign-line" />
          <div className="small">{r}</div>
          <div className="small muted">ስም፣ ፊርማ እና ቀን</div>
        </div>
      ))}
    </div>
  );
}
