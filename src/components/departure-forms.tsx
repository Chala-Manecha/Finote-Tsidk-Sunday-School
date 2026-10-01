'use client';
import { useActionState } from 'react';
import { decideDeparture } from '@/lib/actions/people';
import type { FormState } from '@/components/media-form';

/** ጽሕፈት ቤት: approve with an optional commendation, or reject with a reason. */
export function DecideDepartureForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideDeparture, {});
  return (
    <form action={action} className="card" style={{ marginTop: 8 }}>
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label>ምስጋና / የአገልግሎት አስተያየት (በምስክር ወረቀቱ ላይ ይታተማል፤ አማራጭ)</label>
        <textarea name="commendation" rows={2} placeholder={`ለምሳሌ፦ ${name} በታማኝነትና በትጋት አገልግለዋል።`} />
      </div>
      <div className="field"><label>የመከልከያ ምክንያት (ሲከለከል ብቻ)</label><input name="decision_note" /></div>
      <div className="btn-row">
        <button className="btn sm green" name="decision" value="approved" disabled={pending}>አጽድቅ</button>
        <button className="btn sm secondary" name="decision" value="rejected" disabled={pending}>ከልክል</button>
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
