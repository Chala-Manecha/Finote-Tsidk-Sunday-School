'use client';
import { useActionState } from 'react';
import { submitFeedback, type FormState } from '@/lib/actions/feedback';
import { DEPARTMENTS } from '@/lib/constants';

export function FeedbackForm({ members }: { members: { id: string; full_name: string }[] }) {
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
          <label htmlFor="fb-member">ስምዎት <span className="req">*</span></label>
          <select id="fb-member" name="member_id" required defaultValue="">
            <option value="" disabled>ስምዎትን ይምረጡ</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <span className="hint">ስምዎ ከሌለ በቢሮ ቁጥር 9 ይመዝገቡ።</span>
        </div>
        <div className="field">
          <label htmlFor="fb-dept">አስተያየቱ የሚመለከተው ክፍል <span className="req">*</span></label>
          <select id="fb-dept" name="dept" required defaultValue="">
            <option value="" disabled>ክፍል ይምረጡ</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fb-contact">Telegram ወይም ስልክ</label>
          <input id="fb-contact" name="contact" dir="ltr" placeholder="@username ወይም 09…" />
          <span className="hint">መልስ እንዲደርስዎ።</span>
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
