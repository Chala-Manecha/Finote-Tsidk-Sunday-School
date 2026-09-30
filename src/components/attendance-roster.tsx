'use client';
import { useMemo, useState, useTransition } from 'react';
import { ATTENDANCE_STATUS, type AttendanceStatus } from '@/lib/constants';

export type RosterMember = { id: string; full_name: string };

type Props = {
  members: RosterMember[];
  initial: Record<string, AttendanceStatus>;
  /** New sessions start editable; saved ones start locked (history). */
  startLocked: boolean;
  saveLabel: string;
  onSave: (statuses: Record<string, AttendanceStatus>) => Promise<{ error?: string } | void>;
  onDelete?: () => Promise<void>;
};

export function AttendanceRoster({ members, initial, startLocked, saveLabel, onSave, onDelete }: Props) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(initial);
  const [locked, setLocked] = useState(startLocked);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const get = (id: string) => statuses[id] ?? 'absent';
  const counts = useMemo(() => {
    const c = { present: 0, half: 0, absent: 0 };
    for (const m of members) c[get(m.id)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, statuses]);

  const shown = q ? members.filter((m) => m.full_name.includes(q)) : members;

  const setAll = (s: AttendanceStatus) =>
    setStatuses(Object.fromEntries(members.map((m) => [m.id, s])));

  const save = () =>
    start(async () => {
      setMsg(null);
      // Send every member's status so the saved row set is complete.
      const all = Object.fromEntries(members.map((m) => [m.id, get(m.id)]));
      const res = await onSave(all);
      if (res && res.error) setMsg({ kind: 'error', text: res.error });
      else {
        setMsg({ kind: 'ok', text: 'ተቀምጧል።' });
        if (startLocked) setLocked(true);
      }
    });

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><b>{counts.present}</b>ተገኝቷል</div>
        <div className="stat-card"><b>{counts.half}</b>ግማሽ</div>
        <div className="stat-card"><b>{counts.absent}</b>ቀሪ</div>
        <div className="stat-card"><b>{members.length}</b>ጠቅላላ አባላት</div>
      </div>

      <div className="toolbar no-print">
        <div className="field">
          <label htmlFor="roster-q">ስም ይፈልጉ</label>
          <input id="roster-q" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!locked && (
          <>
            <button type="button" className="btn sm secondary" onClick={() => setAll('present')}>ሁሉም ተገኝቷል</button>
            <button type="button" className="btn sm secondary" onClick={() => setAll('absent')}>ሁሉም ቀሪ</button>
          </>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>ሙሉ ስም</th><th>ተሳትፎ</th></tr></thead>
          <tbody>
            {shown.map((m, i) => {
              const s = get(m.id);
              return (
                <tr key={m.id} className={`roster-row ${s}`}>
                  <td>{i + 1}</td>
                  <td>{m.full_name}</td>
                  <td>
                    {locked ? (
                      <span className={`pill ${s}`}>{ATTENDANCE_STATUS[s]}</span>
                    ) : (
                      <select
                        aria-label={`${m.full_name} ተሳትፎ`}
                        value={s}
                        onChange={(e) => setStatuses({ ...statuses, [m.id]: e.target.value as AttendanceStatus })}
                      >
                        {(Object.keys(ATTENDANCE_STATUS) as AttendanceStatus[]).map((k) => (
                          <option key={k} value={k}>{ATTENDANCE_STATUS[k]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky-actions btn-row no-print">
        {locked ? (
          <button type="button" className="btn" onClick={() => { setLocked(false); setMsg(null); }}>አርም</button>
        ) : (
          <>
            <button type="button" className="btn green" onClick={save} disabled={pending}>
              {pending ? 'በማስቀመጥ ላይ…' : saveLabel}
            </button>
            {startLocked && (
              <button type="button" className="btn secondary" disabled={pending}
                onClick={() => { setStatuses(initial); setLocked(true); }}>
                ሰርዝ
              </button>
            )}
          </>
        )}
        {onDelete && (
          <button
            type="button"
            className="btn danger"
            disabled={pending}
            onClick={() => {
              if (confirm('ይህን ክፍለ ጊዜ ሙሉ በሙሉ ማጥፋት ይፈልጋሉ?')) start(() => onDelete());
            }}
          >
            ክፍለ ጊዜ አጥፋ
          </button>
        )}
        {msg && <span className={`alert ${msg.kind}`} style={{ margin: 0 }}>{msg.text}</span>}
      </div>
    </>
  );
}
