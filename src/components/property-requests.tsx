import { DEPT_NAME, ITEM_CONDITION, formatBirr, type ItemCondition } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { ActionButton } from './action-button';
import { ReasonForm } from './reason-form';
import { approvePropertyRequest, rejectPropertyRequest, withdrawPropertyRequest } from '@/lib/actions/property';

export type PropertyRequest = {
  id: string; dept: string; name: string; qty: number; price: number | null; condition: ItemCondition;
  source: string; note: string | null; registered_on: string; status: 'pending' | 'approved' | 'rejected';
  reason: string | null; decided_at: string | null; created_at: string;
};
export const PROPERTY_REQUEST_COLS = 'id, dept, name, qty, price, condition, source, note, registered_on, status, reason, decided_at, created_at';

const STATUS = { pending: ['በመጠባበቅ ላይ', 'half'], approved: ['ጸድቋል', 'present'], rejected: ['ተመልሷል', 'absent'] } as const;

/** `mode`: 'finance' = approve/return buttons; 'dept' = the department withdraws its own pending request. */
export function PropertyRequestTable({ rows, mode, showDept }: { rows: PropertyRequest[]; mode?: 'finance' | 'dept'; showDept?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showDept && <th>ክፍል</th>}
            <th>ዕቃ</th><th className="num">ብዛት</th><th className="num">የአንዱ ዋጋ</th><th className="num">ጠቅላላ</th>
            <th>ሁኔታ</th><th>ምንጭ</th><th>የተመዘገበበት ቀን</th><th>ውሳኔ</th>{mode && <th className="no-print" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {showDept && <td>{DEPT_NAME[r.dept]}</td>}
              <td>{r.name}{r.note && <div className="small muted" style={{ whiteSpace: 'pre-line' }}>{r.note}</div>}</td>
              <td className="num">{r.qty}</td>
              <td className="num">{r.price == null ? '—' : formatBirr(r.price)}</td>
              <td className="num">{r.price == null ? '—' : formatBirr(r.price * r.qty)}</td>
              <td>{ITEM_CONDITION[r.condition]}</td>
              <td className="small">{r.source}</td>
              <td className="small">{formatEc(r.registered_on)}</td>
              <td>
                <span className={`pill ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                {r.reason && <div className="small muted">{r.reason}</div>}
                {r.decided_at && <div className="small muted">{formatEc(r.decided_at)}</div>}
              </td>
              {mode && (
                <td className="no-print">
                  {r.status === 'pending' && (mode === 'finance' ? (
                    <div className="btn-row">
                      <ActionButton action={approvePropertyRequest.bind(null, r.id)} label="✓ አጽድቅ" className="btn sm green"
                        confirmText={`“${r.name}” (${r.qty}) በ${DEPT_NAME[r.dept]} ንብረት ውስጥ ይመዝገብ?`} />
                      <ReasonForm action={rejectPropertyRequest} id={r.id} field="reason" button="መልስ" placeholder="ምክንያት" />
                    </div>
                  ) : (
                    <ActionButton action={withdrawPropertyRequest.bind(null, r.id)} label="ሰርዝ" className="btn sm secondary" confirmText="ጥያቄውን መሰረዝ ይፈልጋሉ?" />
                  ))}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={10} className="muted">ምንም ጥያቄ የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
