'use client';
import { useState } from 'react';
import { PROGRAMS, PROGRAM_CODES, PROGRAM_HINT, type ProgramCode } from '@/lib/constants';

/** Registration: ሁሉም + one box per programme (ticked = taking part at once). */
export function ProgramPick({ initial }: { initial: string[] | null }) {
  const [on, setOn] = useState<Set<string>>(new Set(initial ?? []));
  const all = PROGRAM_CODES.every((p) => on.has(p));
  const flip = (p: ProgramCode) => setOn((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  return (
    <div className="program-grid">
      <label className={`program-opt all ${all ? 'on' : ''}`}>
        <input type="checkbox" checked={all} onChange={() => setOn(all ? new Set() : new Set(PROGRAM_CODES))} />
        <span><b>ሁሉም</b><small>ሁሉንም ምረጥ</small></span>
      </label>
      {PROGRAM_CODES.map((p) => (
        <label key={p} className={`program-opt ${on.has(p) ? 'on' : ''}`}>
          <input type="checkbox" name="programs" value={p} checked={on.has(p)} onChange={() => flip(p)} />
          <span><b>{PROGRAMS[p].label}</b><small>{PROGRAM_HINT[p]}</small></span>
        </label>
      ))}
    </div>
  );
}
