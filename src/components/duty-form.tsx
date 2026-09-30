'use client';
import { useActionState } from 'react';
import { EcDatePicker } from './ec-date-picker';
import { saveDuty, type FormState } from '@/lib/actions/duty';
import { DUTIES, OCCASIONS } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

type Initial = { id: string; member_id: string; duty: string; duty_date: string; occasion: string };

export function DutyForm({
  dept, members, initial,
}: {
  dept: string;
  members: { id: string; full_name: string }[];
  initial?: Initial;
}) {
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await saveDuty(prev, fd);
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  const key = initial ? 0 : state.n ?? 0;
  const sfx = initial?.id ?? 'new';

  return (
    <form action={action} className={initial ? '' : 'card'}>
      <input type="hidden" name="dept" value={dept} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`m-${sfx}`}>አባል <span className="req">*</span></label>
          <select id={`m-${sfx}`} name="member_id" required defaultValue={initial?.member_id ?? ''}>
            <option value="" disabled>አባል ይምረጡ</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`d-${sfx}`}>ምድብ <span className="req">*</span></label>
          <select id={`d-${sfx}`} name="duty" required defaultValue={initial?.duty ?? ''}>
            <option value="" disabled>ምድብ ይምረጡ</option>
            {DUTIES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም) <span className="req">*</span></span>
          <EcDatePicker key={key} name="duty_date" defaultIso={initial?.duty_date ?? todayIsoAddis()}
            yearsBack={1} yearsForward={1} required />
        </div>
        <div className="field">
          <label htmlFor={`o-${sfx}`}>ምክንያት <span className="req">*</span></label>
          <select id={`o-${sfx}`} name="occasion" required defaultValue={initial?.occasion ?? ''}>
            <option value="" disabled>ምክንያት ይምረጡ</option>
            {OCCASIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>{pending ? '…' : initial ? 'ለውጥ አስቀምጥ' : '+ አባል መድብ'}</button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
