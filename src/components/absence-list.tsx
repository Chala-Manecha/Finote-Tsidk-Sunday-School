import { formatEc } from '@/lib/ethiopian-calendar';
import type { AbsGroup } from '@/lib/absences';

/** One row per member: name + number of absent days; click a row to see each date and where. */
export function AbsenceList({ groups, halfLabel = 'ግማሽ', whatLabel = 'የቀረበት', empty = 'በዚህ ጊዜ የቀረ የለም።' }: {
  groups: AbsGroup[]; halfLabel?: string; whatLabel?: string; empty?: string;
}) {
  if (groups.length === 0) return <p className="muted card">{empty}</p>;
  const total = groups.reduce((t, g) => t + g.count, 0);
  return (
    <div className="abs-list">
      <div className="abs-head"><span>አባል</span><span className="num">ቀሪ ቀናት</span><span className="num">{halfLabel}</span></div>
      {groups.map((g) => (
        <details key={g.memberId} className="abs-row">
          <summary>
            <span><b>{g.name}</b> <span className="small muted">{g.regNo}</span></span>
            <span className="num"><span className={`abs-count ${g.count >= 3 ? 'hi' : ''}`}>{g.count}</span></span>
            <span className="num small">{g.half || '—'}</span>
          </summary>
          <table>
            <thead><tr><th>ቀን</th><th>{whatLabel}</th></tr></thead>
            <tbody>
              {g.items.map((i, k) => (
                <tr key={k}><td>{formatEc(i.date, { weekday: true })}</td><td>{i.label}{i.note ? <span className="small muted"> — {i.note}</span> : null}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
      <p className="small muted" style={{ margin: '8px 4px 0' }}>{groups.length} አባላት · በጠቅላላ {total} ቀሪ ቀናት · ረድፉን ሲጫኑ ቀኖቹ ይታያሉ።</p>
    </div>
  );
}
