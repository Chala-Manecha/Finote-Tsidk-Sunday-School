import { DEPT_NAME } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { ActionButton } from './action-button';
import { DutyForm } from './duty-form';
import { deleteDuty } from '@/lib/actions/duty';

export type DutyRow = {
  id: string; member_id: string; dept: string; duty: string; duty_date: string; occasion: string;
  members: { full_name: string } | null;
};

/** Assignments table; rows from `editableDept` get edit/delete controls. */
export function DutyTable({
  rows, members, editableDept, showDept,
}: {
  rows: DutyRow[];
  members: { id: string; full_name: string }[];
  editableDept?: string;
  showDept?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ስም</th><th>ምድብ</th><th>ቀን</th><th>ምክንያት</th>
            {showDept && <th>የመደበው ክፍል</th>}
            {editableDept && <th className="no-print"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.members?.full_name ?? '—'}</td>
              <td>{r.duty}</td>
              <td>{formatEc(r.duty_date, { weekday: true })}</td>
              <td>{r.occasion}</td>
              {showDept && <td>{DEPT_NAME[r.dept]}</td>}
              {editableDept && (
                <td className="no-print">
                  {r.dept === editableDept && (
                    <div className="btn-row">
                      <details>
                        <summary className="btn sm secondary">አርም</summary>
                        <div className="card" style={{ marginTop: 8, minWidth: 300 }}>
                          <DutyForm dept={r.dept} members={members} initial={r} />
                        </div>
                      </details>
                      <ActionButton action={deleteDuty.bind(null, r.id)} label="አጥፋ" className="btn sm danger"
                        confirmText="ይህን ምደባ ማጥፋት ይፈልጋሉ?" />
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">ምንም ምደባ የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
