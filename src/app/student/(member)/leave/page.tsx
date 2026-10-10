import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { LEAVE_REASON, type LeaveReason } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { requestMyLeave } from '@/lib/actions/leave';

export const metadata: Metadata = { title: 'መልቀቂያ ለመጠየቅ' };

const STATUS: Record<string, [string, string]> = {
  pending: ['ጽሕፈት ቤት በመጠባበቅ ላይ', 'half'], approved: ['ጸድቋል', 'present'], rejected: ['ተቀባይነት አላገኘም', 'absent'],
};
type D = { id: string; status: string; requested_at: string; leave_date: string; reason_category: LeaveReason; decided_at: string | null; cert_no: string | null; reinstated_at: string | null };

/** A member asks to leave the Sunday school (must be signed in). */
export default async function LeaveRequest() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_departures');
  const rows = (data ?? []) as D[];
  const open = rows.some((r) => r.status === 'pending' || (r.status === 'approved' && !r.reinstated_at));

  return (
    <>
      <h1 className="title" style={{ marginTop: 0 }}>መልቀቂያ ለመጠየቅ</h1>
      <p className="muted small">{me.fullName} · {me.regNo}። ጥያቄዎ ለጽሕፈት ቤት ይደርሳል፤ ሲጸድቅ የመልቀቂያ የምስክር ወረቀትዎን ከሰው ሃብት አስተዳደር (ቢሮ ቁጥር 7) ይወስዳሉ።</p>
      {!open && (
        <MediaForm action={requestMyLeave} submitLabel="ጥያቄውን ላክ">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="reason_category">ምክንያት</label>
              <select id="reason_category" name="reason_category" required defaultValue="">
                <option value="" disabled>ይምረጡ</option>
                {Object.entries(LEAVE_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="label">የሚለቁበት ቀን (ዓ.ም)</span>
              <EcDatePicker name="leave_date" defaultIso={todayIsoAddis()} yearsBack={0} yearsForward={1} />
            </div>
          </div>
          <div className="field"><label htmlFor="reason_text">በራስዎ አገላለጽ</label><textarea id="reason_text" name="reason_text" rows={3} required minLength={3} /></div>
        </MediaForm>
      )}
      {rows.length > 0 && (
        <>
          <h2 className="section">ጥያቄዎቼ</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>የተጠየቀበት</th><th>ምክንያት</th><th>የሚለቁበት</th><th>ሁኔታ</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatEc(r.requested_at)}</td>
                    <td>{LEAVE_REASON[r.reason_category]}</td>
                    <td>{formatEc(r.leave_date)}</td>
                    <td>
                      <span className={`pill ${STATUS[r.status]?.[1] ?? ''}`}>{r.reinstated_at ? 'ተመልሰው ገብተዋል' : STATUS[r.status]?.[0] ?? r.status}</span>
                      {r.cert_no && <div className="small muted">የምስክር ወረቀት ቁ. {r.cert_no}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
