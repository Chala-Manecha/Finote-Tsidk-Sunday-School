'use client';
import { useActionState } from 'react';
import { EcDatePicker } from './ec-date-picker';
import {
  requestMoney, addExpense, reportEarning, flagRequest, type FormState,
} from '@/lib/actions/money';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

type Counted = FormState & { n?: number };

/**
 * Wraps a server action so each successful submit bumps `n`. React resets
 * native inputs after a form action; the EC date picker holds its own state,
 * so we remount it with key={n} on success.
 */
function useCountedAction(fn: (s: FormState, fd: FormData) => Promise<FormState>) {
  return useActionState<Counted, FormData>(async (prev, fd) => {
    const res = await fn(prev, fd);
    return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
  }, {});
}

function Status({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
      {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
    </>
  );
}

export function RequestMoneyForm({ dept }: { dept: string }) {
  const [state, action, pending] = useCountedAction(requestMoney);
  const key = state.n ?? 0;
  return (
    <form action={action} className="card">
      <input type="hidden" name="dept" value={dept} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="rq-amount">የገንዘብ መጠን (ብር) <span className="req">*</span></label>
          <input id="rq-amount" name="amount" type="number" min="0.01" step="0.01" required dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="rq-reason">ምክንያት <span className="req">*</span></label>
          <input id="rq-reason" name="reason" required />
        </div>
        <div className="field">
          <span className="label">የሚያስፈልግበት ቀን (ዓ.ም)</span>
          <EcDatePicker key={key} name="needed_by" yearsBack={0} yearsForward={1} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>{pending ? '…' : 'ገንዘብ ጠይቅ'}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ExpenseForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useCountedAction(addExpense);
  const key = state.n ?? 0;
  return (
    <form action={action}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`ex-a-${requestId}`}>የወጣው መጠን (ብር)</label>
          <input id={`ex-a-${requestId}`} name="amount" type="number" min="0.01" step="0.01" required dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor={`ex-r-${requestId}`}>የወጣበት ምክንያት</label>
          <input id={`ex-r-${requestId}`} name="reason" required />
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም)</span>
          <EcDatePicker key={key} name="spent_on" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={0} required />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn sm" disabled={pending}>{pending ? '…' : '+ ወጪ መዝግብ'}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function EarningForm({ dept, amount, source }: { dept: string; amount?: string; source?: string }) {
  const [state, action, pending] = useCountedAction(reportEarning);
  const key = state.n ?? 0;
  return (
    <form action={action} className="card">
      <input type="hidden" name="dept" value={dept} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="er-amount">መጠን (ብር) <span className="req">*</span></label>
          <input id="er-amount" name="amount" type="number" min="0.01" step="0.01" required dir="ltr" defaultValue={key === 0 ? amount : undefined} />
        </div>
        <div className="field">
          <label htmlFor="er-source">የገቢው ምንጭ <span className="req">*</span></label>
          <input id="er-source" name="source" required placeholder="ለምሳሌ፦ የሱቅ ሽያጭ፣ ስጦታ…" defaultValue={key === 0 ? source : undefined} />
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም) <span className="req">*</span></span>
          <EcDatePicker key={key} name="earned_on" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={0} required />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>{pending ? '…' : 'ገቢ ሪፖርት አድርግ'}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function FlagForm({ id, flagged, note }: { id: string; flagged: boolean; note: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(flagRequest, {});
  return (
    <form action={action} className="btn-row">
      <input type="hidden" name="id" value={id} />
      <label className="check" style={{ margin: 0 }}>
        <input type="checkbox" name="audit_flag" defaultChecked={flagged} /> ምልክት
      </label>
      <div className="field" style={{ margin: 0 }}>
        <input name="audit_note" defaultValue={note ?? ''} placeholder="ማስታወሻ" />
      </div>
      <button className="btn sm" disabled={pending}>{pending ? '…' : 'አስቀምጥ'}</button>
      <Status state={state} />
    </form>
  );
}
