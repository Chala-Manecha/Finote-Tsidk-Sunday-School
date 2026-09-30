import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isDeptCode, EVENT_STATUS, STATUS_PILL, type EventStatus } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { EventForm } from '@/components/event-form';
import { ActionButton } from '@/components/action-button';
import { deleteEvent } from '@/lib/actions/events';

type Ev = { id: string; title: string; event_date: string; event_time: string; status: EventStatus; decided_at: string | null };

export default async function RequestEventPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!isDeptCode(dept) || dept === 'schedule') notFound();

  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_date, event_time, status, decided_at')
    .eq('dept', dept)
    .order('event_date', { ascending: false })
    .limit(100)
    .returns<Ev[]>();

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ቀጠሮ ላክ</h2>
      <p className="muted small">ቀጠሮው ወደ መርሓ ግብራት ይላካል፤ እስኪጸድቅ &quot;በመጠባበቅ ላይ&quot; ይቆያል።</p>
      <EventForm dept={dept} />

      <h2 className="section">የላክናቸው ቀጠሮዎች</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ቀን</th><th>ሰዓት</th><th>የዝግጅቱ ስም</th><th>ሁኔታ</th><th></th></tr></thead>
          <tbody>
            {(events ?? []).map((e) => (
              <tr key={e.id}>
                <td>{formatEc(e.event_date, { weekday: true })}</td>
                <td dir="ltr">{e.event_time.slice(0, 5)}</td>
                <td>{e.title}</td>
                <td><span className={`pill ${STATUS_PILL[e.status]}`}>{EVENT_STATUS[e.status]}</span></td>
                <td>
                  {e.status === 'pending' && (
                    <ActionButton
                      action={deleteEvent.bind(null, e.id)}
                      label="ሰርዝ"
                      className="btn sm danger"
                      confirmText="ይህን ቀጠሮ መሰረዝ ይፈልጋሉ?"
                    />
                  )}
                </td>
              </tr>
            ))}
            {events?.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን ቀጠሮ አልላካችሁም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
