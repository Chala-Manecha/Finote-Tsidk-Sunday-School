import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, EVENT_STATUS, STATUS_PILL, type EventStatus } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { EventForm } from '@/components/event-form';
import { ActionButton } from '@/components/action-button';
import { decideEvent, deleteEvent } from '@/lib/actions/events';
import { PrintButton } from '@/components/print-button';

type Ev = { id: string; title: string; event_date: string; event_time: string; status: EventStatus; dept: string };

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
    .select('id, title, event_date, event_time, status, dept')
    .order('event_date')
    .order('event_time');
  if (!sp.past) q = q.gte('event_date', today);
  if (sp.status) q = q.eq('status', sp.status);
  const { data: events } = await q.returns<Ev[]>();

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
                <td dir="ltr">{e.event_time.slice(0, 5)}</td>
                <td>
                  {e.title}
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
