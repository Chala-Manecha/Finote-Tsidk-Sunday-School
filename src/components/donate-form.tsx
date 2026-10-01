'use client';
import { useActionState, useState } from 'react';
import { submitDonation } from '@/lib/actions/receipts';
import type { FormState } from '@/components/media-form';

export function DonateForm() {
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await submitDonation(prev, fd);
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  const [anonymous, setAnonymous] = useState(false);
  return (
    <form action={action} className="card" key={state.n}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="d-name">ሙሉ ስም</label>
          <input id="d-name" name="donor_name" disabled={anonymous} required={!anonymous} />
          <label className="check small" style={{ marginTop: 6 }}>
            <input type="checkbox" name="anonymous" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> ስሜ አይገለጽ (ስም አልባ)
          </label>
        </div>
        <div className="field"><label htmlFor="d-phone">ስልክ (ደረሰኝ ለመውሰድ)</label><input id="d-phone" name="donor_phone" dir="ltr" placeholder="09…" /></div>
        <div className="field"><label htmlFor="d-amount">የላኩት መጠን (ብር) <span className="req">*</span></label><input id="d-amount" name="amount" type="number" min={1} step="0.01" required /></div>
        <div className="field">
          <label htmlFor="d-method">የላኩበት <span className="req">*</span></label>
          <select id="d-method" name="method" required defaultValue="">
            <option value="" disabled>ይምረጡ</option>
            <option value="telebirr">Telebirr</option>
            <option value="cbe">CBE (የኢትዮጵያ ንግድ ባንክ)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-txn">የግብይት ቁጥር (Transaction ID) <span className="req">*</span></label>
          <input id="d-txn" name="txn_ref" dir="ltr" required placeholder="ከSMS መልእክቱ ላይ" autoComplete="off" />
          <span className="hint">ይህን ቁጥር ደረሰኝዎን ለመከታተል ይጠቀሙበታል።</span>
        </div>
        <div className="field"><label htmlFor="d-purpose">ለምን (ካለ)</label><input id="d-purpose" name="purpose" placeholder="ለምሳሌ፦ ለበዓል ዝግጅት" /></div>
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>{pending ? '…' : 'ረድቻለሁ — ላክ'}</button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn sm secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
    }}>{done ? '✓ ተቀድቷል' : 'ቅዳ'}</button>
  );
}
