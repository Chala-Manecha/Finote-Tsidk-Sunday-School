import { formatEc } from '@/lib/ethiopian-calendar';
import { fmtTime } from '@/lib/ethiopian-calendar';
import type { FixedSchedule, WerebEvent } from '@/lib/schedules';
import { DeliveryBadge } from './delivery-badge';

/** Public cards: weekly fixed schedules and dated (approved) sessions. */
export function ScheduleCards({ fixed, events = [], title }: { fixed: FixedSchedule[]; events?: WerebEvent[]; title: string }) {
  if (fixed.length === 0 && events.length === 0) return null;
  return (
    <section className="sched-box">
      <h2 className="sched-title">🗓 {title}</h2>
      <div className="sched-cards">
        {fixed.map((f) => (
          <div key={f.id} className="sched-card">
            <span className="sched-tag">ቋሚ</span>
            <b>{f.title}</b>
            <span>{f.day_text}{f.time_text ? ` · ${f.time_text}` : ''}</span>
            {f.place && <span className="small muted">📍 {f.place}</span>}
            <DeliveryBadge d={f} showLink={!!f.link} />
            {f.note && <span className="small muted">{f.note}</span>}
          </div>
        ))}
        {events.map((e) => (
          <div key={e.id} className="sched-card dated">
            <span className="sched-tag">ቀጠሮ</span>
            <b>{e.title}</b>
            <span>{formatEc(e.event_date, { weekday: true })} · <span dir="ltr">{fmtTime(e.event_time)}</span></span>
            {e.place && <span className="small muted">📍 {e.place}</span>}
            <DeliveryBadge d={e} showLink={!!e.link} />
          </div>
        ))}
      </div>
    </section>
  );
}
