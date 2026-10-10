import Link from 'next/link';
import { DEPT_NAME, formatBirr } from '@/lib/constants';
import type { DeptMoneySummary } from '@/lib/money-data';

/** One row per department: ጸደቀ / የወጣ / ከራስ ወጪ / ተመላሽ / ገቢ, with totals. */
export function DeptMoneySummaryTable({
  rows, detailHref, showEarned = true, showSelf = true,
}: {
  rows: DeptMoneySummary[];
  detailHref?: (dept: string) => string;
  showEarned?: boolean;
  showSelf?: boolean;
}) {
  const total = rows.reduce(
    (t, r) => ({
      approved: t.approved + r.approved, spent: t.spent + r.spent,
      self_contributed: t.self_contributed + r.self_contributed, refund: t.refund + r.refund,
      earned: t.earned + r.earned,
    }),
    { approved: 0, spent: 0, self_contributed: 0, refund: 0, earned: 0 },
  );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ክፍል</th><th className="num">የጸደቀ</th><th className="num">የወጣ</th>
            {showSelf && <th className="num">ከራስ ወጪ</th>}<th className="num">ተመላሽ</th>
            {showEarned && <th className="num">ገቢ</th>}
            {detailHref && <th className="no-print"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dept}>
              <td>{DEPT_NAME[r.dept]}</td>
              <td className="num">{formatBirr(r.approved)}</td>
              <td className="num">{formatBirr(r.spent)}</td>
              {showSelf && <td className="num">{formatBirr(r.self_contributed)}</td>}
              <td className="num">{formatBirr(r.refund)}</td>
              {showEarned && <td className="num">{formatBirr(r.earned)}</td>}
              {detailHref && (
                <td className="no-print"><Link className="link" href={detailHref(r.dept)}>ዝርዝር</Link></td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="muted">እስካሁን የጸደቀ ገንዘብ ወይም ገቢ የለም።</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td>ጠቅላላ</td>
              <td className="num">{formatBirr(total.approved)}</td>
              <td className="num">{formatBirr(total.spent)}</td>
              {showSelf && <td className="num">{formatBirr(total.self_contributed)}</td>}
              <td className="num">{formatBirr(total.refund)}</td>
              {showEarned && <td className="num">{formatBirr(total.earned)}</td>}
              {detailHref && <td className="no-print" />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
