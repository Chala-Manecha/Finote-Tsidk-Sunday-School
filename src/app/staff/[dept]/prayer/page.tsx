import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PRAYER_PROGRAMS } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { DayChecks, dayNames } from '@/components/day-checks';
import { savePrayer, deletePrayer } from '@/lib/actions/office';

type P = { id: string; program: string; days: number[]; times: string[] };

function Fields({ p }: { p?: P }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form-grid">
        <div className="field">
          <label>መርኀ ግብር</label>
          <input name="program" list="prayer-programs" required defaultValue={p?.program} />
          <datalist id="prayer-programs">{PRAYER_PROGRAMS.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <div className="field">
          <label>ሰዓት(ቶች)</label>
          <input name="times" defaultValue={p?.times.join(', ')} placeholder="ለምሳሌ፦ ጠዋት 12:00, ማታ 11:00" />
          <span className="hint">ከአንድ በላይ ከሆነ በኮማ ይለዩ።</span>
        </div>
      </div>
      <div className="field"><span className="label">ቀናት</span><DayChecks name="days" selected={p?.days} /></div>
    </>
  );
}

export default async function OfficePrayer({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'internal_comm') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('prayer_schedule').select('id, program, days, times').order('created_at');
  const rows = (data ?? []) as P[];
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የጸሎት መርኀ ግብር አስተዳደር</h2>
      <MediaForm action={savePrayer} submitLabel="+ ጨምር"><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>መርኀ ግብር</th><th>ቀናት</th><th>ሰዓት</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.program}</td>
                <td>{dayNames(p.days)}</td>
                <td>{p.times.join('፣ ') || '—'}</td>
                <td>
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 320 }}>
                        <MediaForm action={savePrayer} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}><Fields p={p} /></MediaForm>
                      </div>
                    </details>
                    <ActionButton action={deletePrayer.bind(null, p.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">ምንም የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
