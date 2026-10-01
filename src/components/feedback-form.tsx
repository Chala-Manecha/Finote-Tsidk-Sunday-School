'use client';
import { useActionState } from 'react';
import { submitFeedback, type FormState } from '@/lib/actions/feedback';
import { DEPARTMENTS } from '@/lib/constants';

export function FeedbackForm() {
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await submitFeedback(prev, fd);
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  return (
    <form action={action} className="card" key={state.n}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="fb-reg">የመመዝገቢያ ቁጥር <span className="req">*</span></label>
          <input id="fb-reg" name="reg_no" required dir="ltr" placeholder="ፍጽ-XXXX-XXXX" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="fb-tg">Telegram username</label>
          <input id="fb-tg" name="telegram" dir="ltr" placeholder="@username" autoComplete="off" />
          <span className="hint">ሲመዘገቡ Telegram ካላስገቡ ባዶ ይተዉት።</span>
        </div>
        <div className="field">
          <label htmlFor="fb-dept">አስተያየቱ የሚመለከተው ክፍል <span className="req">*</span></label>
          <select id="fb-dept" name="dept" required defaultValue="">
            <option value="" disabled>ክፍል ይምረጡ</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="fb-message">አስተያየት <span className="req">*</span></label>
        <textarea id="fb-message" name="message" rows={5} required maxLength={4000} />
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>{pending ? '…' : 'ላክ'}</button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
