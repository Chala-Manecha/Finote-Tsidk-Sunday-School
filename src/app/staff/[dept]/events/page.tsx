import Link from 'next/link';
import { fmtTime } from '@/lib/ethiopian-calendar';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, EVENT_STATUS, STATUS_PILL, type EventStatus } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { EventForm } from '@/components/event-form';
import { DeliveryBadge } from '@/components/delivery-badge';
import { EVENT_KINDS, type Delivery } from '@/lib/constants';
import { ActionButton } from '@/components/action-button';
import { decideEvent, deleteEvent } from '@/lib/actions/events';
import { PrintButton } from '@/components/print-button';
import { FIXED_KINDS, fixedSchedules } from '@/lib/schedules';
import { dayNames } from '@/components/day-checks';

type Ev = { id: string; title: string; event_date: string; event_time: string; status: EventStatus; dept: string; kind: string | null; place: string | null } & Delivery;

export default async function ScheduleEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ status?: string; past?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'schedule') notFound();
  const sp = await searchParams;
  const today = todayIsoAddis();

  const supabase = await createClient();
  let q = supabase
    .from('events')
    .select('id, title, event_date, event_time, status, dept, kind, place, mode, platform, link')
    .order('event_date')
    .order('event_time');
  // Upcoming events, plus every pending one whatever its date, so nothing waits unseen.
  if (!sp.past) q = q.or(`event_date.gte.${today},status.eq.pending`);
  if (sp.status) q = q.eq('status', sp.status);
  const [{ data: events }, fixed, { data: abnet }, { data: prayer }] = await Promise.all([
    q.returns<Ev[]>(),
    fixedSchedules(supabase),
    supabase.from('abnet_sessions').select('id, subject, teacher, day_text, time_text').order('created_at'),
    supabase.from('prayer_schedule').select('id, program, days, times').order('created_at'),
  ]);
  // Every weekly schedule in one list, so a new ቀጠሮ doesn't clash with a fixed one.
  const weekly: { key: string; what: string; who: string; when: string }[] = [
    ...fixed.map((f) => ({ key: f.id, what: `${f.title} (${FIXED_KINDS[f.kind]})`, who: DEPT_NAME[f.dept], when: [f.day_text, f.time_text, f.place].filter(Boolean).join(' · ') })),
    ...(abnet ?? []).map((a) => ({ key: a.id, what: `አብነት፦ ${a.subject ?? ''}`, who: DEPT_NAME.education, when: [a.day_text, a.time_text].filter(Boolean).join(' · ') || '—' })),
    ...(prayer ?? []).map((p) => ({ key: p.id, what: p.program, who: 'የጸሎት መርኀ ግብር', when: [dayNames(p.days), (p.times ?? []).join('፣ ')].filter(Boolean).join(' · ') || '—' })),
  ];

  // Same date+time as another APPROVED event → warn (doesn't block)
  const approvedSlots = new Map<string, string[]>();
  for (const e of events ?? []) {
    if (e.status !== 'approved') continue;
    const k = `${e.event_date} ${e.event_time}`;
    approvedSlots.set(k, [...(approvedSlots.get(k) ?? []), e.id]);
  }
  const clashes = (e: Ev) =>
    (approvedSlots.get(`${e.event_date} ${e.event_time}`) ?? []).some((id) => id !== e.id);

  const pendingCount = (events ?? []).filter((e) => e.status === 'pending').length;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ቀጠሮዎች</h2>
      <details className="no-print">
        <summary className="btn sm" style={{ display: 'inline-flex' }}>+ የመርሓ ግብራት ቀጠሮ ጨምር</summary>
        <div style={{ marginTop: 10 }}><EventForm dept="schedule" /></div>
      </details>

      {weekly.length > 0 && (
        <details className="card fold-card" style={{ margin: '12px 0' }}>
          <summary><b>🔁 ቋሚ (ሳምንታዊ) መርሐ ግብሮች</b> <span className="small muted">({weekly.length}) — አዲስ ቀጠሮ ከነዚህ ጋር እንዳይደራረብ</span></summary>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>መርሐ ግብር</th><th>ክፍል</th><th>ቀንና ሰዓት</th></tr></thead>
              <tbody>{weekly.map((w) => <tr key={w.key}><td>{w.what}</td><td className="small">{w.who}</td><td>{w.when}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      )}

      <form className="toolbar no-print" action="/staff/schedule/events">
        <div className="field">
          <label htmlFor="status">ሁኔታ</label>
          <select id="status" name="status" defaultValue={sp.status ?? ''}>
            <option value="">ሁሉም</option>
            {Object.entries(EVENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="check"><input type="checkbox" name="past" defaultChecked={!!sp.past} /> ያለፉትንም አሳይ</label>
        <button className="btn sm">አጣራ</button>
        <span style={{ flex: 1 }} />
        <PrintButton />
      </form>
      {pendingCount > 0 && <div className="alert error">{pendingCount} ቀጠሮ ውሳኔ ይጠብቃል።</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ቀን</th><th>ሰዓት</th><th>የዝግጅቱ ስም</th><th>የጠየቀው ክፍል</th><th>ሁኔታ</th><th className="no-print"></th></tr>
          </thead>
          <tbody>
            {(events ?? []).map((e) => (
              <tr key={e.id}>
                <td>{formatEc(e.event_date, { weekday: true })}</td>
                <td dir="ltr">{fmtTime(e.event_time)}</td>
                <td>
                  {e.kind && <span className="pill">{EVENT_KINDS[e.kind]}</span>} {e.title}
                  {e.place && <div className="small muted">📍 {e.place}</div>}<div><DeliveryBadge d={e} compact /></div>
                  {clashes(e) && <div className="small" style={{ color: 'var(--danger)' }}>⚠ ተደራቢ — በዚህ ሰዓት ሌላ የጸደቀ ቀጠሮ አለ</div>}
                </td>
                <td>{DEPT_NAME[e.dept]}</td>
                <td><span className={`pill ${STATUS_PILL[e.status]}`}>{EVENT_STATUS[e.status]}</span></td>
                <td className="no-print">
                  <div className="btn-row">
                    {e.status === 'pending' && (
                      <>
                        <ActionButton action={decideEvent.bind(null, e.id, 'approved')} label="አጽድቅ" className="btn sm green" />
                        <ActionButton action={decideEvent.bind(null, e.id, 'rejected')} label="ከልክል" className="btn sm secondary" />
                      </>
                    )}
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div className="card" style={{ marginTop: 8, minWidth: 280 }}>
                        <EventForm dept={e.dept} initial={e} />
                      </div>
                    </details>
                    <ActionButton action={deleteEvent.bind(null, e.id)} label="አጥፋ" className="btn sm danger"
                      confirmText="ይህን ቀጠሮ ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {events?.length === 0 && <tr><td colSpan={6} className="muted">ምንም ቀጠሮ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">የሚመጡት ሳምንት የጸደቁ ቀጠሮዎች በ<Link className="link" href="/">መነሻ ገጽ</Link> ይታያሉ።</p>
    </>
  );
}
