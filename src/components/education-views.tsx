import { formatEc } from '@/lib/ethiopian-calendar';
import { MediaForm } from './media-form';
import { EcDatePicker } from './ec-date-picker';
import { ActionButton } from './action-button';
import { DayChecks, dayNames } from './day-checks';
import {
  savePlan, deletePlan, saveCourseSession, deleteCourseSession, saveAbnet, deleteAbnet,
} from '@/lib/actions/education';

export type Plan = {
  id: string; course_name: string; class_name: string | null; teacher: string | null;
  start_date: string | null; mid_exam_date: string | null; final_exam_date: string | null;
  mid_mark: number | null; final_mark: number | null; notebook_mark: number | null; attendance_mark: number | null;
};
export type CourseSession = { id: string; name: string; class_name: string | null; teacher: string | null; days: number[] };
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

// ---------- plan ----------
export function PlanFields({ p }: { p?: Plan }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form-grid">
        <div className="field"><label>የኮርሱ ስም</label><input name="course_name" required defaultValue={p?.course_name} /></div>
        <div className="field"><label>ክፍል</label><input name="class_name" defaultValue={p?.class_name ?? ''} /></div>
        <div className="field"><label>መምህር</label><input name="teacher" defaultValue={p?.teacher ?? ''} /></div>
        <div className="field"><span className="label">Course Start</span><EcDatePicker name="start_date" defaultIso={p?.start_date} yearsBack={1} yearsForward={1} /></div>
        <div className="field"><span className="label">Mid Exam</span><EcDatePicker name="mid_exam_date" defaultIso={p?.mid_exam_date} yearsBack={1} yearsForward={1} /></div>
        <div className="field"><span className="label">Final Exam</span><EcDatePicker name="final_exam_date" defaultIso={p?.final_exam_date} yearsBack={1} yearsForward={1} /></div>
        <div className="field"><label>Mid ማርክ</label><input name="mid_mark" type="number" min={0} max={100} defaultValue={p?.mid_mark ?? 30} /></div>
        <div className="field"><label>Final ማርክ</label><input name="final_mark" type="number" min={0} max={100} defaultValue={p?.final_mark ?? 50} /></div>
        <div className="field"><label>ደብተር ማርክ</label><input name="notebook_mark" type="number" min={0} max={100} defaultValue={p?.notebook_mark ?? ''} /></div>
        <div className="field"><label>አቴንዳንስ ማርክ</label><input name="attendance_mark" type="number" min={0} max={100} defaultValue={p?.attendance_mark ?? ''} /></div>
      </div>
    </>
  );
}

export function PlanTable({ rows, editable }: { rows: Plan[]; editable?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>የኮርሱ ስም</th><th>ክፍል</th><th>Course Start</th><th>Mid Exam</th><th>Final Exam</th>
            <th>ደብተር</th><th>አቴንዳንስ</th><th>መምህር</th>{editable && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.course_name}</td>
              <td>{p.class_name ?? '—'}</td>
              <td>{formatEc(p.start_date)}</td>
              <td>{formatEc(p.mid_exam_date)}{p.mid_mark != null && ` (${p.mid_mark})`}</td>
              <td>{formatEc(p.final_exam_date)}{p.final_mark != null && ` (${p.final_mark})`}</td>
              <td>{p.notebook_mark ?? '—'}</td>
              <td>{p.attendance_mark ?? '—'}</td>
              <td>{p.teacher ?? '—'}</td>
              {editable && (
                <td>
                  <div className="btn-row">
                    <Edit><MediaForm action={savePlan} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}><PlanFields p={p} /></MediaForm></Edit>
                    <ActionButton action={deletePlan.bind(null, p.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9} className="muted">እስካሁን ዕቅድ የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------- course sessions ----------
export function CourseSessionFields({ c }: { c?: CourseSession }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="form-grid">
        <div className="field"><label>የኮርሱ ስም</label><input name="name" required defaultValue={c?.name} /></div>
        <div className="field"><label>ክፍል</label><input name="class_name" defaultValue={c?.class_name ?? ''} /></div>
        <div className="field"><label>መምህር</label><input name="teacher" defaultValue={c?.teacher ?? ''} /></div>
      </div>
      <div className="field"><span className="label">ቀናት</span><DayChecks name="days" selected={c?.days} /></div>
    </>
  );
}

export function CourseSessionTable({ rows, editable }: { rows: CourseSession[]; editable?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>ኮርስ</th><th>ክፍል</th><th>መምህር</th><th>ቀናት</th>{editable && <th />}</tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td><td>{c.class_name ?? '—'}</td><td>{c.teacher ?? '—'}</td><td>{dayNames(c.days)}</td>
              {editable && (
                <td>
                  <div className="btn-row">
                    <Edit><MediaForm action={saveCourseSession} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}><CourseSessionFields c={c} /></MediaForm></Edit>
                    <ActionButton action={deleteCourseSession.bind(null, c.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">ምንም ቀጠሮ የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------- አብነት ----------

export function AbnetFields({ a }: { a?: Abnet }) {
  return (
    <>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="form-grid">
        <div className="field"><label>የሚሰጡ ትምህርቶች</label><input name="subject" required defaultValue={a?.subject ?? ''} placeholder="ለምሳሌ፦ ንባብ፣ ቅኔ" /></div>
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
