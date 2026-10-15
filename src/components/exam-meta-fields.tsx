import { EcDatePicker } from './ec-date-picker';
import { TimePicker } from './time-picker';
import { EXAM_COMPONENTS, addisParts, type Exam } from '@/lib/exams';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

/** Title, type, length and the window in which students may start. */
export function ExamMetaFields({ offeringId, e }: { offeringId: string; e?: Exam }) {
  const o = e ? addisParts(e.opens_at) : { date: todayIsoAddis(), time: '08:00' };
  const c = e ? addisParts(e.closes_at) : { date: todayIsoAddis(), time: '17:00' };
  const k = e?.id ?? 'new';
  return (
    <div className="exam-meta">
      <input type="hidden" name="offering_id" value={offeringId} />
      {e && <input type="hidden" name="id" value={e.id} />}

      <div className="exam-meta-sec">
        <span className="exam-meta-h">የፈተና አይነት</span>
        <div className="exam-type-pick">
          {Object.entries(EXAM_COMPONENTS).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="component" value={v} defaultChecked={(e?.component ?? 'quiz') === v} />
              <span><i aria-hidden>{v === 'quiz' ? '📝' : v === 'mid' ? '📗' : '🎓'}</i>{l}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="exam-meta-sec two">
        <div className="field">
          <label htmlFor={`tt-${k}`}>ርዕስ <span className="req">*</span></label>
          <input id={`tt-${k}`} name="title" required minLength={2} maxLength={160} defaultValue={e?.title} placeholder="ለምሳሌ፦ የምዕራፍ 1–3 ፈተና" />
        </div>
        <div className="field">
          <label htmlFor={`dur-${k}`}>የፈተናው ርዝመት <span className="req">*</span></label>
          <div className="input-unit"><input id={`dur-${k}`} name="duration_min" type="number" min={1} max={300} required defaultValue={e?.duration_min ?? 30} /><span>ደቂቃ</span></div>
        </div>
      </div>

      <div className="exam-meta-sec two">
        <div className="field">
          <span className="label">🟢 መክፈቻ</span>
          <div className="date-time"><EcDatePicker name="open_date" defaultIso={o.date} yearsBack={0} yearsForward={1} required /><TimePicker name="open_time" required defaultValue={o.time} label="የመክፈቻ ሰዓት" /></div>
        </div>
        <div className="field">
          <span className="label">🔴 መዝጊያ</span>
          <div className="date-time"><EcDatePicker name="close_date" defaultIso={c.date} yearsBack={0} yearsForward={1} required /><TimePicker name="close_time" required defaultValue={c.time} label="የመዝጊያ ሰዓት" /></div>
        </div>
      </div>

      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`ins-${k}`}>መመሪያ ለተማሪዎች <span className="small muted">(አማራጭ)</span></label>
        <textarea id={`ins-${k}`} name="instructions" rows={2} maxLength={2000} defaultValue={e?.instructions ?? ''} placeholder="ለምሳሌ፦ ሁሉንም ጥያቄዎች ይመልሱ።" />
      </div>
      <p className="hint small">⏱ ተማሪው በመክፈቻና በመዝጊያ መካከል ሲጀምር የራሱ ሰዓት ይቆጠራል፤ ሰዓቱ ሲያልቅ ወይም መዝጊያው ሲደርስ ፈተናው በራሱ ይገባል። (የአዲስ አበባ ሰዓት)</p>
    </div>
  );
}
