'use client';
import { useActionState } from 'react';
import { EcDatePicker } from './ec-date-picker';
import { saveDuty, type FormState } from '@/lib/actions/duty';
import { DutyFields } from './duty-fields';
import { useModalClose } from './modal';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

type Initial = { id: string; member_id: string; duty: string; duty_date: string; occasion: string };

export function DutyForm({
  dept, members, initial, plain = false, choice,
}: {
  dept: string;
  plain?: boolean;
  members: { id: string; full_name: string }[];
  initial?: Initial;
  /** allocate a member's own choice: their name, job, day and occasion come filled in */
  choice?: Initial;
}) {
  const close = useModalClose();
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await saveDuty(prev, fd);
      if (res.ok && !initial) close?.();
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  const key = initial ? 0 : state.n ?? 0;
  const sfx = initial?.id ?? (choice ? `c-${choice.id}` : 'new');
  const pre = initial ?? choice;

  return (
    <form action={action} className={initial || plain ? '' : 'card'}>
      <input type="hidden" name="dept" value={dept} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {choice && <input type="hidden" name="from_choice" value={choice.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`m-${sfx}`}>አባል <span className="req">*</span></label>
          <select id={`m-${sfx}`} name="member_id" required defaultValue={pre?.member_id ?? ''}>
            <option value="" disabled>አባል ይምረጡ</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም) <span className="req">*</span></span>
          <EcDatePicker key={key} name="duty_date" defaultIso={pre?.duty_date ?? todayIsoAddis()}
            yearsBack={1} yearsForward={1} required />
        </div>
        <DutyFields duty={pre?.duty} occasion={pre?.occasion} sfx={sfx} />
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>{pending ? '…' : initial ? 'ለውጥ አስቀምጥ' : '+ መድብ'}</button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
