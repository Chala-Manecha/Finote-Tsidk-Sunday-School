import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PROGRAMS, programsForDept, type ProgramCode } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { addToProgram, returnToWaiting } from '@/lib/actions/programs';
import { PickList } from '@/components/pick-list';
import { ActionButton } from '@/components/action-button';
import { SegLinks } from '@/components/seg-links';
import { PrintButton } from '@/components/print-button';

type Row = { member_id: string; status: 'chosen' | 'active' | 'declined'; decided_at: string | null; members: { full_name: string; reg_no: string; phone: string | null } };

/** Who chose this department's program: add them (→ attendance list) or see who takes part. */
export default async function Participants({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ p?: string; q?: string }>;
}) {
  const { dept } = await params;
  const programs = programsForDept(dept);
  if (programs.length === 0) notFound();
  const sp = await searchParams;
  const program: ProgramCode = programs.includes(sp.p as ProgramCode) ? (sp.p as ProgramCode) : programs[0];
  const supabase = await createClient();
  const { data } = await supabase.from('member_programs')
    .select('member_id, status, decided_at, members!inner(full_name, reg_no, phone, is_active)')
    .eq('program', program).eq('members.is_active', true).returns<Row[]>();
  const q = sp.q?.trim();
  const rows = (data ?? []).filter((r) => !q || r.members.full_name.includes(q) || r.members.reg_no.includes(q.toUpperCase()))
    .sort((a, b) => a.members.full_name.localeCompare(b.members.full_name, 'am'));
  const waiting = rows.filter((r) => r.status === 'chosen');
  const active = rows.filter((r) => r.status === 'active');
  const declined = rows.filter((r) => r.status === 'declined');
  const base = `/staff/${dept}/participants`;

  return (
    <>
      <div className="head-row">
        <h2 className="section" style={{ margin: 0 }}>ተሳታፊዎች — {PROGRAMS[program].label}</h2>
        <PrintButton />
      </div>
      {programs.length > 1 && <SegLinks current={program} items={programs.map((p) => [p, PROGRAMS[p].label, `${base}?p=${p}`])} />}
      <p className="small muted">አባላት በምዝገባ ወቅት (ወይም ሰው ሃብት በሚያስተካክለው) የመረጡትን ብቻ ይማራሉ/ያገለግላሉ። የመረጡትን እዚህ ሲጨምሩ በክትትል ዝርዝሩ ውስጥ ይገባሉ።{program === 'course' ? ' ኮርስ የተጨመሩ በዚህ ዓመት ዝርዝር ውስጥ ይገባሉ፤ ክፍላቸውን በ“ክፍሎችና ተማሪዎች” ይመድቡ።' : ''}</p>
      <div className="stat-cards">
        <span className="stat-card"><b>{waiting.length}</b>መደመር የሚጠብቁ</span>
        <span className="stat-card"><b>{active.length}</b>ተሳታፊዎች</span>
        <span className="stat-card"><b>{declined.length}</b>ያልመረጡ</span>
      </div>
      <form className="toolbar no-print" action={base}>
        {programs.length > 1 && <input type="hidden" name="p" value={program} />}
        <div className="field"><label htmlFor="q">ስም / ቁጥር</label><input id="q" name="q" type="search" defaultValue={q} /></div>
        <button className="btn sm">ፈልግ</button>
      </form>

      <section className="card no-print" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>የመረጡ — መደመር የሚጠብቁ ({waiting.length})</h3>
        <PickList action={addToProgram} hidden={{ program }} button="✓ ጨምር"
          empty="የሚጠብቅ የለም።"
          rows={waiting.map((r) => ({ id: r.member_id, name: r.members.full_name, sub: r.members.reg_no, extra: r.members.phone ?? '' }))} />
      </section>

      <h3>ተሳታፊዎች ({active.length})</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>አባል</th><th>ስልክ</th><th>የተጨመሩበት</th><th className="no-print" /></tr></thead>
          <tbody>
            {active.map((r, i) => (
              <tr key={r.member_id}>
                <td className="num">{i + 1}</td>
                <td><b>{r.members.full_name}</b> <span className="small muted">{r.members.reg_no}</span></td>
                <td dir="ltr" className="small">{r.members.phone ?? '—'}</td>
                <td className="small">{r.decided_at ? formatEc(r.decided_at.slice(0, 10)) : '—'}</td>
                <td className="no-print"><ActionButton action={returnToWaiting.bind(null, program, r.member_id)} label="ወደ ተጠባባቂ መልስ" className="link small" /></td>
              </tr>
            ))}
            {active.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን የተጨመረ የለም።</td></tr>}
          </tbody>
        </table>
      </div>

      {declined.length > 0 && (
        <details className="card fold-card no-print" style={{ marginTop: 14 }}>
          <summary><b>ያልመረጡ ({declined.length})</b> <span className="small muted">— ምርጫቸውን የሚቀይረው ሰው ሃብት ነው</span></summary>
          <p className="small" style={{ marginBottom: 0 }}>{declined.map((r) => r.members.full_name).join('፣ ')}</p>
        </details>
      )}
    </>
  );
}
