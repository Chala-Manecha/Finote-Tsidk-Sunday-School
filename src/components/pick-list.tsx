'use client';
import { useActionState, useState } from 'react';

type Row = { id: string; name: string; sub?: string; extra?: string };
type State = { error?: string; ok?: string };

/** A list with tick boxes and one button that sends the ticked ids (name="ids") to a server action. */
export function PickList({ rows, action, hidden, button, empty }: {
  rows: Row[]; action: (s: State, fd: FormData) => Promise<State>; hidden: Record<string, string>; button: string; empty: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [state, run, pending] = useActionState(async (prev: State, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) setPicked(new Set());
    return r;
  }, {});
  if (rows.length === 0) return <p className="muted small">{empty}</p>;
  const all = rows.every((r) => picked.has(r.id));
  return (
    <form action={run}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="list-bar">
        <label className="check small"><input type="checkbox" checked={all} onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /> ሁሉንም ምረጥ</label>
        <span style={{ flex: 1 }} />
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
        <button className="btn sm green" disabled={pending || picked.size === 0}>{pending ? '…' : `${button}${picked.size ? ` (${picked.size})` : ''}`}</button>
      </div>
      <div className="table-wrap">
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={picked.has(r.id) ? 'picked' : ''}>
                <td style={{ width: 34 }}>
                  <input type="checkbox" name="ids" value={r.id} checked={picked.has(r.id)} aria-label={r.name}
                    onChange={() => { const n = new Set(picked); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setPicked(n); }} />
                </td>
                <td><b>{r.name}</b> {r.sub && <span className="small muted">{r.sub}</span>}</td>
                <td className="small muted">{r.extra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
