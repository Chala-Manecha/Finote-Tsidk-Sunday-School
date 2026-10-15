'use client';
import { useActionState } from 'react';
import { TimePicker } from './time-picker';
import { EcDatePicker } from './ec-date-picker';
import { proposeEvent, updateEvent, type FormState } from '@/lib/actions/events';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DeliveryFields } from './delivery-fields';
import { EVENT_KINDS, type Delivery } from '@/lib/constants';

type Initial = { id: string; title: string; event_date: string; event_time: string; kind?: string | null; place?: string | null } & Partial<Delivery>;

const KINDS_FOR: Record<string, string[]> = { hr: ['meeting'], mezmur: ['wereb'], education: ['course', 'abnet'] };

/** Add (ቀጠሮ ላክ) or edit an event. All three fields are mandatory. */
export function EventForm({ dept, initial }: { dept: string; initial?: Initial }) {
  const fn = initial ? updateEvent : proposeEvent;
  // Bump `n` on success so the EC date picker (own state) remounts empty.
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await fn(prev, fd);
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  const resetKey = initial ? 0 : state.n ?? 0;

  return (
    <form action={action} className={initial ? '' : 'card'}>
      <input type="hidden" name="dept" value={dept} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="form-grid">
        {(KINDS_FOR[dept] || initial?.kind) && (
          <div className="field">
            <label htmlFor={`kind-${initial?.id ?? 'new'}`}>አይነት</label>
            <select id={`kind-${initial?.id ?? 'new'}`} name="kind" defaultValue={initial?.kind ?? KINDS_FOR[dept]?.[0] ?? ''}>
              <option value="">ዝግጅት / ሌላ</option>
              {(KINDS_FOR[dept] ?? [initial!.kind!]).map((k) => <option key={k} value={k}>{EVENT_KINDS[k]}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor={`title-${initial?.id ?? 'new'}`}>የዝግጅቱ ስም (ርዕስ) <span className="req">*</span></label>
          <input id={`title-${initial?.id ?? 'new'}`} name="title" required defaultValue={initial?.title} />
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም) <span className="req">*</span></span>
          <EcDatePicker key={resetKey} name="event_date" defaultIso={initial?.event_date ?? todayIsoAddis()} yearsBack={1} yearsForward={2} required />
        </div>
        <div className="field">
          <label htmlFor={`time-${initial?.id ?? 'new'}`}>ሰዓት <span className="req">*</span></label>
          <TimePicker id={`time-${initial?.id ?? 'new'}`} name="event_time" required defaultValue={initial?.event_time?.slice(0, 5)} />
        </div>
        <div className="field">
          <label htmlFor={`place-${initial?.id ?? 'new'}`}>ቦታ</label>
          <input id={`place-${initial?.id ?? 'new'}`} name="place" defaultValue={initial?.place ?? ''} />
        </div>
        <DeliveryFields initial={initial} idPrefix={`ev-${initial?.id ?? 'new'}`} />
      </div>
      <div className="btn-row">
        <button className="btn" disabled={pending}>
          {pending ? '…' : initial ? 'ለውጥ አስቀምጥ' : dept === 'schedule' ? '+ ቀጠሮ ጨምር' : 'ቀጠሮ ላክ'}
        </button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
