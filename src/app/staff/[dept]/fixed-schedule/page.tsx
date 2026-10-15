import Link from 'next/link';
import { fmtTime } from '@/lib/ethiopian-calendar';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FIXED_KINDS, fixedSchedules, upcomingWereb, type FixedSchedule } from '@/lib/schedules';
import { saveFixedSchedule, deleteFixedSchedule } from '@/lib/actions/schedules';
import { PopForm } from '@/components/pop-form';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { formatEc } from '@/lib/ethiopian-calendar';
import { DeliveryFields } from '@/components/delivery-fields';
import { DeliveryBadge } from '@/components/delivery-badge';

const DEPTS = ['mezmur'];

function Fields({ dept, f }: { dept: string; f?: FixedSchedule }) {
  const k = f?.id ?? 'new';
  return (
    <>
      <input type="hidden" name="dept" value={dept} />
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`kind-${k}`}>አይነት</label>
          <select id={`kind-${k}`} name="kind" defaultValue={f?.kind ?? 'mezmur'}>
            {Object.entries(FIXED_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`title-${k}`}>ርዕስ <span className="req">*</span></label>
          <input id={`title-${k}`} name="title" required defaultValue={f?.title} placeholder="ለምሳሌ፦ የመዝሙር ጥናት" />
        </div>
        <div className="field">
          <label htmlFor={`day-${k}`}>ቀን <span className="req">*</span></label>
          <input id={`day-${k}`} name="day_text" required defaultValue={f?.day_text} placeholder="ለምሳሌ፦ ዘወትር ቅዳሜ" />
        </div>
        <div className="field">
          <label htmlFor={`time-${k}`}>ሰዓት</label>
          <input id={`time-${k}`} name="time_text" defaultValue={f?.time_text ?? ''} placeholder="ለምሳሌ፦ 8:00 – 10:00 (ጠዋት)" />
        </div>
        <div className="field">
          <label htmlFor={`place-${k}`}>ቦታ</label>
          <input id={`place-${k}`} name="place" defaultValue={f?.place ?? ''} />
        </div>
        <div className="field">
          <label htmlFor={`note-${k}`}>ማስታወሻ</label>
          <input id={`note-${k}`} name="note" defaultValue={f?.note ?? ''} />
        </div>
        <DeliveryFields initial={f} idPrefix={`fx-${k}`} />
      </div>
    </>
  );
}

/** መዝሙር ክፍል: the fixed weekly study times (shown on the public ዜማ page and to መርሓ ግብራት). */
export default async function FixedSchedulePage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!DEPTS.includes(dept)) notFound();
  const supabase = await createClient();
  const [rows, wereb] = await Promise.all([fixedSchedules(supabase, { dept, withLink: true }), upcomingWereb(supabase)]);

  return (
    <>
      <div className="head-row">
        <h2 className="section" style={{ margin: 0 }}>ቋሚ መርሐ ግብር</h2>
        <PopForm label="+ ቋሚ መርሐ ግብር ጨምር" action={saveFixedSchedule} submitLabel="ጨምር"><Fields dept={dept} /></PopForm>
      </div>
      <p className="small muted">በየሳምንቱ የሚደረጉ ጥናቶች — በሕዝብ “ዜማ” ገጽ እና ለመርሓ ግብራት (ቀጠሮዎች) ይታያሉ። ቋሚ ቀን የሌለው የወረብ ጥናት በ<Link className="link" href={`/staff/${dept}/request-event`}>ቀጠሮ ላክ</Link> (አይነት፦ ወረብ ጥናት) ይጠየቃል።</p>

      <div className="table-wrap">
        <table>
          <thead><tr><th>አይነት</th><th>ርዕስ</th><th>ቀን</th><th>ሰዓት</th><th>ቦታ</th><th className="no-print"></th></tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td className="small">{FIXED_KINDS[f.kind]}</td>
                <td><b>{f.title}</b>{f.note && <div className="small muted">{f.note}</div>}</td>
                <td>{f.day_text}</td><td>{f.time_text ?? '—'}</td><td>{f.place ?? '—'}<div><DeliveryBadge d={f} /></div></td>
                <td className="no-print">
                  <div className="btn-row">
                    <details className="pop">
                      <summary className="btn sm secondary">አርም</summary>
                      <div className="pop-body"><MediaForm action={saveFixedSchedule} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}><Fields dept={dept} f={f} /></MediaForm></div>
                    </details>
                    <ActionButton action={deleteFixedSchedule.bind(null, f.id)} label="አጥፋ" className="btn sm danger" confirmText="ይህን መርሐ ግብር ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">እስካሁን ቋሚ መርሐ ግብር አልተጨመረም።</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="section">የጸደቁ የወረብ ጥናት ቀጠሮዎች</h2>
      {wereb.length === 0 ? <p className="muted small">የሚመጣ የጸደቀ የወረብ ጥናት የለም።</p> : (
        <ul className="plain-list">
          {wereb.map((e) => <li key={e.id}><b>{e.title}</b> — {formatEc(e.event_date, { weekday: true })} · <span dir="ltr">{fmtTime(e.event_time)}</span>{e.place ? ` · ${e.place}` : ''}</li>)}
        </ul>
      )}
    </>
  );
}
