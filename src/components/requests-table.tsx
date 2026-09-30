import { DEPT_NAME, MONEY_STATUS, STATUS_PILL, formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import type { RequestRow } from '@/lib/money-data';
import { ActionButton } from './action-button';
import { FlagForm } from './money-forms';
import { approveSpend, decideRequest, markPaid } from '@/lib/actions/money';

/**
 * Cross-department money request list.
 *   office  → approve / reject pending
 *   finance → mark approved as paid
 *   audit   → flag with a note
 */
export function RequestsTable({ rows, mode }: { rows: RequestRow[]; mode: 'office' | 'finance' | 'audit' }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ክፍል</th><th className="num">መጠን</th><th>ምክንያት</th><th>የሚያስፈልግበት</th>
            <th>የጠየቀበት ቀን</th><th>የጸደቀበት ቀን</th><th>ሁኔታ</th>
            {mode !== 'office' && <th className="num">የወጣ</th>}
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{DEPT_NAME[r.dept]}</td>
              <td className="num">{formatBirr(r.amount)}</td>
              <td>
                {r.reason}
                {r.audit_flag && mode !== 'audit' && (
                  <div className="small" style={{ color: 'var(--danger)' }}>⚑ ኦዲት{r.audit_note ? `፦ ${r.audit_note}` : ''}</div>
                )}
              </td>
              <td>{r.needed_by ? formatEc(r.needed_by) : '—'}</td>
              <td>{formatEc(r.requested_at)}</td>
              <td>{r.decided_at ? formatEc(r.decided_at) : '—'}</td>
              <td>
                <span className={`pill ${STATUS_PILL[r.status]}`}>{MONEY_STATUS[r.status]}</span>
                {r.paid_at && <div className="small muted">{formatEc(r.paid_at)}</div>}
              </td>
              {mode !== 'office' && (
                <td className="num">
                  {formatBirr(r.spent)}
                  {r.spend_approved_at && <div className="small" style={{ color: 'var(--green)' }}>✓ ወጪ ሪፖርት ጸድቋል</div>}
                </td>
              )}
              <td className="no-print">
                <div className="btn-row">
                  {mode === 'office' && r.status === 'pending' && (
                    <>
                      <ActionButton action={decideRequest.bind(null, r.id, 'approved')} label="አጽድቅ" className="btn sm green" />
                      <ActionButton action={decideRequest.bind(null, r.id, 'rejected')} label="ከልክል" className="btn sm secondary"
                        confirmText="ጥያቄውን መከልከል ይፈልጋሉ?" />
                    </>
                  )}
                  {mode === 'finance' && r.status === 'approved' && (
                    <ActionButton action={markPaid.bind(null, r.id)} label="ገንዘብ ተከፈለ" className="btn sm green"
                      confirmText={`${formatBirr(r.amount)} ለ${DEPT_NAME[r.dept]} ተከፍሏል?`} />
                  )}
                  {mode === 'finance' && (r.status === 'approved' || r.status === 'paid') && !r.spend_approved_at && r.lines.length > 0 && (
                    <ActionButton action={approveSpend.bind(null, r.id)} label="ወጪ ሪፖርት አጽድቅ" className="btn sm secondary"
                      confirmText={`የ${DEPT_NAME[r.dept]} ወጪ ሪፖርት (${formatBirr(r.spent)}) ይጽደቅ? ከጸደቀ በኋላ መቀየር አይቻልም።`} />
                  )}
                  {mode === 'audit' && <FlagForm id={r.id} flagged={r.audit_flag} note={r.audit_note} />}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9} className="muted">ምንም ጥያቄ የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
