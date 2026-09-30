import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MAHIBER_NAMES } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { ActionButton } from '@/components/action-button';
import { saveMahiber, deleteMahiber } from '@/lib/actions/office';

type M = { id: string; association_name: string; event_date: string; event_time: string | null; rescheduled: boolean };

function Fields({ m }: { m?: M }) {
  return (
    <>
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="form-grid">
        <div className="field">
          <label>የማኅበሩ ስም</label>
          <input name="association_name" list="mahiber-names" required defaultValue={m?.association_name} />
          <datalist id="mahiber-names">{MAHIBER_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም)</span>
          <EcDatePicker name="event_date" defaultIso={m?.event_date} yearsBack={1} yearsForward={1} required />
        </div>
        <div className="field">
          <label>ሰዓት</label>
          <input name="event_time" type="time" defaultValue={m?.event_time?.slice(0, 5)} />
        </div>
      </div>
      <label className="check"><input type="checkbox" name="rescheduled" defaultChecked={m?.rescheduled} /> ተሸጋሽጓል</label>
    </>
  );
}

export default async function OfficeMahiberat({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('mahiberat').select('*').order('event_date', { ascending: false });
  const rows = (data ?? []) as M[];
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ማኀበራት አስተዳደር</h2>
      <MediaForm action={saveMahiber} submitLabel="+ ጨምር"><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ማኅበር</th><th>ቀን</th><th>ሰዓት</th><th></th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.association_name}</td>
                <td>{formatEc(m.event_date, { weekday: true })}</td>
                <td dir="ltr">{m.event_time?.slice(0, 5) ?? '—'}</td>
                <td>{m.rescheduled && <span className="pill half">ተሸጋሽጓል</span>}</td>
                <td>
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 300 }}>
                        <MediaForm action={saveMahiber} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}><Fields m={m} /></MediaForm>
                      </div>
                    </details>
                    <ActionButton action={deleteMahiber.bind(null, m.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">ምንም የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
