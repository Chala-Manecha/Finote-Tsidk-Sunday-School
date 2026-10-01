import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTURE_STATUS, LEAVE_REASON, type DepartureStatus, type LeaveReason } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { DecideDepartureForm } from '@/components/departure-forms';
import { requestDeparture, withdrawDeparture, reinstateMember } from '@/lib/actions/people';

type D = {
  id: string; member_id: string; leave_date: string; reason_text: string; reason_category: LeaveReason;
  status: DepartureStatus; commendation: string | null; decision_note: string | null; requested_at: string;
  decided_at: string | null; cert_no: string | null; print_count: number; reinstated_at: string | null;
  members: { full_name: string; reg_no: string } | null;
};
const COLS = 'id, member_id, leave_date, reason_text, reason_category, status, commendation, decision_note, requested_at, decided_at, cert_no, print_count, reinstated_at, members(full_name, reg_no)';

/** HR requests · ጽሕፈት ቤት approves · ኦዲት tracks. */
export default async function Departures({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!['hr', 'office', 'audit'].includes(dept)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: members }] = await Promise.all([
    supabase.from('member_departures').select(COLS).order('requested_at', { ascending: false }),
    dept === 'hr' ? supabase.from('members').select('id, full_name, reg_no').eq('is_active', true).order('full_name') : Promise.resolve({ data: [] }),
  ]);
  const rows = (data ?? []) as unknown as D[];
  const pending = rows.filter((r) => r.status === 'pending');

  const byReason = Object.entries(
    rows.filter((r) => r.status === 'approved').reduce<Record<string, number>>((m, r) => ({ ...m, [r.reason_category]: (m[r.reason_category] ?? 0) + 1 }), {}),
  );

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>{dept === 'office' ? 'የመልቀቂያ ጥያቄዎች ማጸደቂያ' : 'መልቀቂያ የሚወስዱ አባላት'}</h2>
      <p className="muted small">
        HR ጥያቄውን ይመዘግባል → ጽሕፈት ቤት ያጸድቃል → አባሉ ከዝርዝሮች ይወጣል (ታሪኩ ይቀመጣል) → HR የምስክር ወረቀቱን ያትማል። ኦዲት ሁሉንም ይከታተላል።
      </p>

      {dept === 'hr' && (
        <MediaForm action={requestDeparture} submitLabel="ለጽሕፈት ቤት ላክ">
          <div className="form-grid">
            <div className="field">
              <label>አባል</label>
              <select name="member_id" required defaultValue="">
                <option value="" disabled>ይምረጡ</option>
                {(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.reg_no}</option>)}
              </select>
            </div>
            <div className="field"><span className="label">የሚለቁበት ቀን (ዓ.ም)</span><EcDatePicker name="leave_date" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={1} required /></div>
            <div className="field">
              <label>የምክንያት አይነት</label>
              <select name="reason_category" required defaultValue="">
                <option value="" disabled>ይምረጡ</option>
                {Object.entries(LEAVE_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>አባሉ የገለጹት ምክንያት (በራሳቸው አገላለጽ)</label><textarea name="reason_text" rows={2} required /></div>
        </MediaForm>
      )}

      {dept === 'audit' && byReason.length > 0 && (
        <div className="stat-cards">
          {byReason.map(([k, n]) => <div key={k} className="stat-card"><b>{n}</b>{LEAVE_REASON[k as LeaveReason]}</div>)}
        </div>
      )}

      {dept === 'office' && (
        <>
          <h3 className="section">ውሳኔ የሚጠብቁ ({pending.length})</h3>
          {pending.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 12 }}>
              <b>{r.members?.full_name}</b> <span className="small muted">{r.members?.reg_no}</span>
              <p className="small" style={{ margin: '6px 0' }}>
                {formatEc(r.leave_date)} · {LEAVE_REASON[r.reason_category]} — “{r.reason_text}”
              </p>
              <DecideDepartureForm id={r.id} name={r.members?.full_name ?? ''} />
            </div>
          ))}
          {pending.length === 0 && <p className="muted">የሚጠብቅ ጥያቄ የለም።</p>}
          <h3 className="section">ታሪክ</h3>
        </>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>አባል</th><th>የሚለቁበት</th><th>ምክንያት</th><th>ሁኔታ</th><th>ምስክር ወረቀት</th><th /></tr></thead>
          <tbody>
            {(dept === 'office' ? rows.filter((r) => r.status !== 'pending') : rows).map((r) => (
              <tr key={r.id}>
                <td>{r.members?.full_name}<div className="small muted">{r.members?.reg_no}</div></td>
                <td>{formatEc(r.leave_date)}</td>
                <td><span className="small">{LEAVE_REASON[r.reason_category]}</span><div className="small muted">“{r.reason_text}”</div></td>
                <td>
                  <span className={`pill ${r.status === 'approved' ? 'present' : r.status === 'rejected' ? 'absent' : 'half'}`}>{DEPARTURE_STATUS[r.status]}</span>
                  {r.decision_note && <div className="small muted">{r.decision_note}</div>}
                  {r.reinstated_at && <div className="small" style={{ color: 'var(--green)' }}>ተመልሰው ገብተዋል · {formatEc(r.reinstated_at)}</div>}
                </td>
                <td>
                  {r.cert_no
                    ? <Link className="link" href={`/staff/certificates/${r.id}`}>{r.cert_no}</Link>
                    : <span className="small muted">ከጸደቀ በኋላ</span>}
                  {r.cert_no && <div className="small muted">{r.print_count ? `${r.print_count} ጊዜ ታትሟል` : 'አልታተመም'}</div>}
                </td>
                <td>
                  {dept === 'hr' && r.status === 'pending' && (
                    <ActionButton action={withdrawDeparture.bind(null, r.id)} label="ሰርዝ" className="btn sm danger" confirmText="ጥያቄውን መሰረዝ ይፈልጋሉ?" />
                  )}
                  {dept !== 'audit' && r.status === 'approved' && !r.reinstated_at && (
                    <ActionButton action={reinstateMember.bind(null, r.id)} label="መልሰህ አስገባ" className="btn sm secondary"
                      confirmText={`${r.members?.full_name} ተመልሰው አባል ይሁኑ?`} />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">እስካሁን ጥያቄ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
