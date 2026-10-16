import { DEPT_NAME, DUTY_SOURCE } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { ActionButton } from './action-button';
import { DutyForm } from './duty-form';
import { confirmDuty, deleteDuty } from '@/lib/actions/duty';

export type DutyStatus = 'done' | 'missed' | null;
export type DutyRow = {
  id: string; member_id: string; dept: string | null; duty: string; duty_date: string; occasion: string; status: DutyStatus;
  source: 'given' | 'chosen'; accepted_at: string | null;
  members: { full_name: string } | null;
};
export const DUTY_COLS = 'id, member_id, dept, duty, duty_date, occasion, status, source, accepted_at, members(full_name)';
export const DUTY_STATUS = { done: 'ፈጽሟል', missed: 'አልፈጸመም' } as const;

type PillInput = { status: DutyStatus; duty_date: string; source?: string; accepted_at?: string | null };
/** where a job stands: waiting for the member → accepted → done / missed (or expired) */
export function dutyStage(d: PillInput) {
  const today = todayIsoAddis();
  if (d.status) return d.status;
  if (d.source !== 'chosen' && !d.accepted_at) return d.duty_date >= today ? 'awaiting' : 'expired';
  return d.duty_date > today ? 'accepted' : 'confirm';
}
const STAGE: Record<string, [string, string]> = {
  done: ['present', 'ፈጽሟል'], missed: ['absent', 'አልፈጸመም'], awaiting: ['half', 'አባሉ እንዲቀበል ይጠብቃል'],
  expired: ['', 'ጊዜው አልፏል'], accepted: ['pending', 'ተቀብሏል'], confirm: ['pending', 'ማረጋገጫ ይጠብቃል'],
};
export function DutyPill(d: PillInput) {
  const stage = dutyStage(d);
  const [cls, label] = STAGE[stage];
  return <span className={`pill ${cls}`}>{stage === 'accepted' && d.source === 'chosen' ? 'መርጠዋል' : label}</span>;
}

/** Jobs table. Rows of `editableDept` get edit/delete (until accepted) and done / missed (after the day). */
export function DutyTable({
  rows, members, editableDept, showDept, confirmChosen,
}: {
  rows: DutyRow[];
  members: { id: string; full_name: string }[];
  editableDept?: string;
  showDept?: boolean;
  /** ሰው ሃብት / የውስጥ ግንኙነት confirm the jobs members chose themselves */
  confirmChosen?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ስም</th>{showDept && <th>ክፍል</th>}<th>ምድብ</th><th>በአል</th><th>ቀን</th><th>ምንጭ</th><th>ሁኔታ</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const stage = dutyStage(r);
            const mine = (editableDept && r.dept === editableDept) || (confirmChosen && r.dept === null);
            return (
              <tr key={r.id}>
                <td>{r.members?.full_name ?? '—'}</td>
                {showDept && <td className="small">{r.dept ? DEPT_NAME[r.dept] : 'በራሳቸው'}</td>}
                <td>{r.duty}</td>
                <td>{r.occasion}</td>
                <td>{formatEc(r.duty_date, { weekday: true })}</td>
                <td><span className={`pill ${r.source === 'chosen' ? 'present' : ''}`}>{DUTY_SOURCE[r.source]}</span></td>
                <td><DutyPill {...r} /></td>
                <td className="no-print">
                  {mine && (
                    <div className="btn-row">
                      {(stage === 'confirm' || stage === 'done' || stage === 'missed') && (
                        <>
                          {r.status !== 'done' && <ActionButton action={confirmDuty.bind(null, r.id, 'done')} label="✓ ፈጽሟል" className="btn xs green" />}
                          {r.status !== 'missed' && <ActionButton action={confirmDuty.bind(null, r.id, 'missed')} label="✗ አልፈጸመም" className="btn xs secondary" />}
                          {r.status && <ActionButton action={confirmDuty.bind(null, r.id, null)} label="ቀልብስ" className="link small" />}
                        </>
                      )}
                      {editableDept && r.dept === editableDept && !r.accepted_at && (
                        <>
                          <details className="pop">
                            <summary className="btn xs secondary">አርም</summary>
                            <div className="pop-body"><DutyForm dept={r.dept} members={members} initial={r} plain /></div>
                          </details>
                          <ActionButton action={deleteDuty.bind(null, r.id)} label="አጥፋ" className="btn xs danger" confirmText="ይህን ምደባ ማጥፋት ይፈልጋሉ?" />
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={8} className="muted">ምንም ምደባ የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
