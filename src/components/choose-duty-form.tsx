'use client';
import { useActionState, useState } from 'react';
import { DUTIES, OCCASIONS } from '@/lib/constants';
import { chooseDuty, type FormState } from '@/lib/actions/duty';
import { EcDatePicker } from './ec-date-picker';
import { useModalClose } from './modal';

/** The member offers a job — or to teach a lower class / አብነት. Cannot be changed once sent. */
export function ChooseDutyForm({ today, classes, initialDuty }: { today: string; classes: { value: string; label: string }[]; initialDuty?: string }) {
  const close = useModalClose();
  const [pick, setPick] = useState(initialDuty && ((DUTIES as readonly string[]).includes(initialDuty) || initialDuty === 'teach_abnet' || (initialDuty === 'teach_course' && classes.length > 0)) ? initialDuty : '');
  const [state, run, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await chooseDuty(prev, fd);
    if (r.ok) setTimeout(() => close?.(), 900);
    return r;
  }, {});
  const teach = pick === 'teach_course' || pick === 'teach_abnet';
  return (
    <form action={run} className="choose-duty">
      <div className="field">
        <label htmlFor="cd-duty">ምድብ <span className="req">*</span></label>
        <select id="cd-duty" name="duty" required value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="" disabled>ይምረጡ</option>
          <optgroup label="መምህርነት">
            {classes.length > 0 && <option value="teach_course">📘 የኮርስ መምህር</option>}
            <option value="teach_abnet">📜 የአብነት መምህር</option>
          </optgroup>
          <optgroup label="አገልግሎት">
            {DUTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="other">ሌላ (ይጻፉ)…</option>
          </optgroup>
        </select>
      </div>
      {pick === 'other' && (
        <div className="field"><label htmlFor="cd-other">የምድቡ ስም <span className="req">*</span></label>
          <input id="cd-other" name="duty_other" required maxLength={80} placeholder="ለምሳሌ፦ ጽዳት" /></div>
      )}
      {pick === 'teach_course' && (
        <div className="field"><label htmlFor="cd-class">የሚያስተምሩት ክፍል <span className="req">*</span></label>
          <select id="cd-class" name="teach_class" required defaultValue="">
            <option value="" disabled>ክፍል ይምረጡ</option>
            {classes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <span className="small muted">ከራስዎ ክፍል በታች ያሉት ብቻ። ትምህርት ክፍል ኮርስ ሲመድብ ያሳውቅዎታል።</span></div>
      )}
      {pick === 'teach_abnet' && (
        <div className="field"><label htmlFor="cd-sub">የሚያስተምሩት (አማራጭ)</label>
          <input id="cd-sub" name="teach_subject" maxLength={60} placeholder="ለምሳሌ፦ ውዳሴ ማርያም፣ ግእዝ" /></div>
      )}
      {!teach && (
        <>
          <div className="field">
            <label htmlFor="cd-occ">በአል <span className="req">*</span></label>
            <select id="cd-occ" name="occasion" required defaultValue="">
              <option value="" disabled>በአል ይምረጡ</option>
              {OCCASIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="field"><span className="label">ቀን <span className="req">*</span></span>
            <EcDatePicker name="duty_date" defaultIso={today} yearsBack={0} yearsForward={1} required /></div>
        </>
      )}
      <div className="btn-row">
        <button className="btn green" disabled={pending || !pick}>{pending ? '…' : 'ላክ'}</button>
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
