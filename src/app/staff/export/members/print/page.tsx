import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CHURCH_NAME, DEPT_NAME, SCHOOL_NAME, isDeptCode } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { EXPORT_TEMPLATES, cellsFor } from '@/lib/member-export';
import { filtersFrom, loadMembers } from '@/lib/member-load';
import { PrintButton } from '@/components/print-button';

/** "PDF table": a printable A4 landscape member table (print → Save as PDF). */
export default async function MembersPrint({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const list = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : one(k) ? [one(k)] : []);
  const scope = (['all', 'filtered', 'selected'] as const).find((x) => x === one('scope')) ?? 'filtered';
  const dept = isDeptCode(one('dept')) ? one('dept') : undefined;
  const cols = list('cols').length ? list('cols') : EXPORT_TEMPLATES[0].cols;
  const supabase = await createClient();
  const [rows, { data: groups }] = await Promise.all([
    loadMembers(supabase, { scope, filters: filtersFrom(sp), dept, ids: list('ids') }),
    supabase.from('age_groups').select('code, name'),
  ]);
  const { headers, body } = cellsFor(rows, cols, {
    groupName: new Map((groups ?? []).map((x) => [x.code as string, x.name as string])), verifyBase: '',
  });

  return (
    <article className="member-print">
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="small muted">በአታሚው “Save as PDF” ይምረጡ።</span>
        <PrintButton />
      </div>
      <header className="member-print-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={54} height={54} />
        <div>
          <b>{SCHOOL_NAME}</b>
          <div className="small">{CHURCH_NAME}</div>
        </div>
        <div className="member-print-title">
          <b>የአባላት ዝርዝር{dept ? ` — ${DEPT_NAME[dept]}` : ''}</b>
          <div className="small">{formatEc(todayIsoAddis())} · {rows.length} አባላት</div>
        </div>
      </header>
      <table className="member-print-table">
        <thead><tr><th>ተ.ቁ</th>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}><td>{i + 1}</td>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
          {body.length === 0 && <tr><td colSpan={headers.length + 1}>ምንም አባል የለም።</td></tr>}
        </tbody>
      </table>
    </article>
  );
}
