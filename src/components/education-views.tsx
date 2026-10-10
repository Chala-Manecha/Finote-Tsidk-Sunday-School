import { MediaForm } from './media-form';
import { MultiSelect } from './multi-select';
import { ABNET_SUBJECTS } from '@/lib/constants';
import { ActionButton } from './action-button';
import { dayNames } from './day-checks';
import {
  saveAbnet, deleteAbnet,
} from '@/lib/actions/education';

const SUBJECT_OPTIONS = ABNET_SUBJECTS.map((x) => ({ value: x, label: x }));

export type Abnet = {
  id: string; subjects: string[]; days: number[]; times: string[]; teacher: string;
  subject: string | null; day_text: string | null; time_text: string | null;
  audio_path: string | null; file_path: string | null; audio_url?: string | null; file_url?: string | null;
};
export const ABNET_COLS = 'id, subjects, days, times, teacher, subject, day_text, time_text, audio_path, file_path';

function Edit({ children }: { children: React.ReactNode }) {
  return (
    <details>
      <summary className="btn sm secondary">አርም</summary>
      <div style={{ marginTop: 8, minWidth: 320 }}>{children}</div>
    </details>
  );
}

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
        <div className="field">
          <label>ድምፅ (አማራጭ) {a?.audio_path ? '(ለመቀየር ብቻ)' : ''}</label>
          <input name="audio" type="file" accept="audio/*" />
          {a?.audio_path && <label className="check" style={{ margin: 0 }}><input type="checkbox" name="remove_audio" /> ድምፁን አጥፋ</label>}
        </div>
        <div className="field">
          <label>ፋይል (አማራጭ) {a?.file_path ? '(ለመቀየር ብቻ)' : ''}</label>
          <input name="file" type="file" accept=".pdf,.doc,.docx,image/*" />
          {a?.file_path && <label className="check" style={{ margin: 0 }}><input type="checkbox" name="remove_file" /> ፋይሉን አጥፋ</label>}
        </div>
      </div>
    </>
  );
}

export function AbnetTable({ rows, editable }: { rows: Abnet[]; editable?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>የሚሰጡ ትምህርቶች</th><th>ቀን</th><th>ሰዐት</th><th>መምህር</th>{editable && <th />}</tr></thead>
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
              <td>{a.teacher}</td>
              {editable && (
                <td>
                  <div className="btn-row">
                    <Edit><MediaForm action={saveAbnet} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false} fileField={['audio', 'file']} folder="abnet"><AbnetFields a={a} /></MediaForm></Edit>
                    <ActionButton action={deleteAbnet.bind(null, a.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">ምንም የአብነት ትምህርት አልተመዘገበም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
