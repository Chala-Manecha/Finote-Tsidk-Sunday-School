import { MediaForm } from './media-form';
import { Modal } from './modal';
import { MultiSelect } from './multi-select';
import { ABNET_SUBJECTS } from '@/lib/constants';
import { ActionButton } from './action-button';
import { dayNames } from './day-checks';
import { DeliveryFields } from './delivery-fields';
import { DeliveryBadge } from './delivery-badge';
import type { Delivery } from '@/lib/constants';
import {
  saveAbnet, deleteAbnet,
} from '@/lib/actions/education';

const SUBJECT_OPTIONS = ABNET_SUBJECTS.map((x) => ({ value: x, label: x }));

export type Abnet = {
  id: string; subjects: string[]; days: number[]; times: string[]; teacher: string;
  subject: string | null; day_text: string | null; time_text: string | null;
  audio_path: string | null; file_path: string | null; audio_url?: string | null; file_url?: string | null; place?: string | null;
} & Partial<Delivery>;
export const ABNET_COLS = 'id, subjects, days, times, teacher, subject, day_text, time_text, audio_path, file_path, mode, platform, place';
/** staff and signed-in members also read the meeting link */
export const ABNET_COLS_LINK = `${ABNET_COLS}, link`;

// ---------- አብነት ----------

export function AbnetFields({ a }: { a?: Abnet }) {
  return (
    <>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="form-grid">
        <div className="field">
          <span className="label">የሚሰጡ ትምህርቶች</span>
          <MultiSelect name="subject" options={SUBJECT_OPTIONS} allowCustom placeholder="ይምረጡ ወይም ይጻፉ"
            defaultValue={(a?.subject ?? a?.subjects.join('፣ ') ?? '').split('፣').map((x) => x.trim()).filter(Boolean)} />
        </div>
        <div className="field"><label>ቀን</label><input name="day_text" required defaultValue={a?.day_text ?? (a?.days?.length ? dayNames(a.days) : '')} placeholder="ለምሳሌ፦ ቅዳሜና እሑድ" /></div>
        <div className="field"><label>ሰዐት</label><input name="time_text" required defaultValue={a?.time_text ?? ''} placeholder="ለምሳሌ፦ ከሰዓት 8:00–10:00" /></div>
        <div className="field"><label>መምህር</label><input name="teacher" required defaultValue={a?.teacher ?? ''} /></div>
        <div className="field"><label>ቦታ / አካባቢ</label><input name="place" maxLength={160} defaultValue={a?.place ?? ''} placeholder="ለምሳሌ፦ የቤተ ክርስቲያኑ አዳራሽ" /></div>
        <DeliveryFields initial={a} idPrefix={`ab-${a?.id ?? 'new'}`} />
      </div>
    </>
  );
}

export function AbnetTable({ rows, editable }: { rows: Abnet[]; editable?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>ትምህርት</th><th>ቀን</th><th>ሰዐት</th><th>ቦታ / ሊንክ</th><th>መምህር</th>{editable && <th />}</tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                {a.subject || a.subjects.join('፣ ')}
                {a.audio_url && <audio controls preload="none" src={a.audio_url} style={{ display: 'block', width: '100%', maxWidth: 280, marginTop: 4 }} />}
                {a.file_url && <div><a className="link small" href={a.file_url} target="_blank" rel="noopener noreferrer">📄 ፋይሉን ክፈት</a></div>}
              </td>
              <td>{a.day_text || dayNames(a.days)}</td>
              <td>{a.time_text || a.times.join('፣ ')}</td>
              <td>{a.place && <div className="small">📍 {a.place}</div>}<DeliveryBadge d={a} showLink={!!a.link} compact /></td>
              <td>{a.teacher}</td>
              {editable && (
                <td>
                  <div className="btn-row">
                    <Modal label="አርም" title="መርሐ ግብር አርም" btnClass="btn sm secondary" size="lg"><MediaForm action={saveAbnet} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false} card={false}><AbnetFields a={a} /></MediaForm></Modal>
                    <ActionButton action={deleteAbnet.bind(null, a.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">ምንም የአብነት መርሐ ግብር አልተመዘገበም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
