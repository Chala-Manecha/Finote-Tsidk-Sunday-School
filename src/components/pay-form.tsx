'use client';
import { useActionState, useState } from 'react';
import { payRequest, confirmReceived, type FormState } from '@/lib/actions/money';
import { PAY_METHOD, type PayMethod } from '@/lib/constants';

/** ሒሳብና ንብረት: hand over the money and record how. */
export function PayForm({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(payRequest, {});
  const [method, setMethod] = useState<PayMethod>('cash');
  return (
    <details>
      <summary className="btn sm green">ክፈል</summary>
      <form action={action} className="card" style={{ marginTop: 8, minWidth: 260 }}>
        <input type="hidden" name="id" value={id} />
        <p className="small" style={{ marginTop: 0 }}>{label}</p>
        <div className="field">
          <label>የአከፋፈል መንገድ</label>
          <select name="pay_method" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {(Object.keys(PAY_METHOD) as PayMethod[]).map((k) => <option key={k} value={k}>{PAY_METHOD[k]}</option>)}
          </select>
        </div>
        {method !== 'cash' && (
          <div className="field"><label>የዝውውር ቁጥር</label><input name="pay_reference" dir="ltr" required /></div>
        )}
        <div className="btn-row">
          <button className="btn sm green" disabled={pending}>{pending ? '…' : 'ተከፍሏል — ማዘዣ አዘጋጅ'}</button>
          {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
          {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
        </div>
      </form>
    </details>
  );
}

/** Requesting department: confirm the cash was received (then sign the printed voucher). */
export function ReceiveForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmReceived, {});
  return (
    <form action={action} className="btn-row" style={{ flexWrap: 'wrap' }}>
      <input type="hidden" name="id" value={id} />
      <input name="received_name" placeholder="የተረከበው ሙሉ ስም" required style={{ minWidth: 170 }} />
      <button className="btn sm green" disabled={pending}>{pending ? '…' : 'ገንዘቡን ተረክበናል'}</button>
      {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
      {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
    </form>
  );
}
