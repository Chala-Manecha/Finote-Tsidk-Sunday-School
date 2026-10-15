import { EcDatePicker } from './ec-date-picker';
import { EXAM_COMPONENTS, addisParts, type Exam } from '@/lib/exams';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

/** Title, type, length and the window in which students may start. */
export function ExamMetaFields({ offeringId, e }: { offeringId: string; e?: Exam }) {
  const o = e ? addisParts(e.opens_at) : { date: todayIsoAddis(), time: '08:00' };
  const c = e ? addisParts(e.closes_at) : { date: todayIsoAddis(), time: '17:00' };
  const k = e?.id ?? 'new';
  return (
    <>
      <input type="hidden" name="offering_id" value={offeringId} />
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`cmp-${k}`}>የፈተና አይነት</label>
          <select id={`cmp-${k}`} name="component" defaultValue={e?.component ?? 'quiz'}>
            {Object.entries(EXAM_COMPONENTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`tt-${k}`}>ርዕስ <span className="req">*</span></label>
          <input id={`tt-${k}`} name="title" required minLength={2} maxLength={160} defaultValue={e?.title} placeholder="ለምሳሌ፦ የምዕራፍ 1–3 ፈተና" />
        </div>
        <div className="field">
          <label htmlFor={`dur-${k}`}>የፈተናው ጊዜ (ደቂቃ) <span className="req">*</span></label>
          <input id={`dur-${k}`} name="duration_min" type="number" min={1} max={300} required defaultValue={e?.duration_min ?? 30} />
        </div>
        <div className="field">
          <span className="label">መክፈቻ (ቀን · ሰዓት)</span>
          <EcDatePicker name="open_date" defaultIso={o.date} yearsBack={0} yearsForward={1} required />
          <input name="open_time" type="time" required defaultValue={o.time} aria-label="የመክፈቻ ሰዓት" style={{ marginTop: 6 }} />
        </div>
        <div className="field">
          <span className="label">መዝጊያ (ቀን · ሰዓት)</span>
          <EcDatePicker name="close_date" defaultIso={c.date} yearsBack={0} yearsForward={1} required />
          <input name="close_time" type="time" required defaultValue={c.time} aria-label="የመዝጊያ ሰዓት" style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`ins-${k}`}>መመሪያ ለተማሪዎች (አማራጭ)</label>
        <textarea id={`ins-${k}`} name="instructions" rows={2} maxLength={2000} defaultValue={e?.instructions ?? ''} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>ተማሪው በመክፈቻና በመዝጊያ መካከል ሲጀምር የራሱ ሰዓት ይቆጠራል፤ ሰዓቱ ሲያልቅ (ወይም መዝጊያው ሲደርስ) ፈተናው በራሱ ይገባል። ሰዓት በአዲስ አበባ አቆጣጠር ነው።</p>
    </>
  );
}
