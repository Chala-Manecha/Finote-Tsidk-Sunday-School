import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PROGRAMS, PROGRAM_CODES, type ProgramCode } from '@/lib/constants';
import { PrintButton } from '@/components/print-button';

type Row = { id: string; full_name: string; reg_no: string; phone: string | null; sex: string; member_programs: { program: string; status: string }[] };
const ICON: Record<ProgramCode, string> = { abnet: '📜', course: '📘', mezmur: '🎵', duty: '🧭' };

/** ጽሕፈት ቤት and ሰው ሃብት: who chose which programme at registration — counts and the list, by filter. */
export default async function ProgramChoices({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ p?: string; q?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'office' && dept !== 'hr') notFound();
  const sp = await searchParams;
  const pick = PROGRAM_CODES.includes(sp.p as ProgramCode) ? (sp.p as ProgramCode) : sp.p === 'none' ? 'none' : null;
  const supabase = await createClient();
  const { data } = await supabase.from('members').select('id, full_name, reg_no, phone, sex, member_programs(program, status)')
    .eq('is_active', true).order('full_name');
  const all = (data ?? []) as Row[];
  const chose = (m: Row) => m.member_programs.filter((x) => x.status !== 'declined').map((x) => x.program as ProgramCode);
  const count = (p: ProgramCode) => all.filter((m) => chose(m).includes(p)).length;
  const none = all.filter((m) => chose(m).length === 0).length;
  const q = sp.q?.trim();
  const rows = all
    .filter((m) => pick === null ? true : pick === 'none' ? chose(m).length === 0 : chose(m).includes(pick))
    .filter((m) => !q || m.full_name.includes(q) || m.reg_no.includes(q.toUpperCase()));
  const base = `/staff/${dept}/program-choices`;
  const href = (p: string | null) => `${base}${p ? `?p=${p}` : ''}`;

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የተማሪዎች ምርጫ</h2>
        <span className="spacer" />
        <form className="toolbar slim no-print" action={base}>
          {pick && <input type="hidden" name="p" value={pick} />}
          <input name="q" type="search" defaultValue={q} placeholder="🔍 ስም / ቁጥር" aria-label="ፈልግ" style={{ width: 170 }} />
        </form>
        <PrintButton />
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>በምዝገባ ጊዜ አባላት መማር / መሳተፍ የመረጡት። አንድ አባል ከአንድ በላይ ሊመርጥ ይችላል።</p>

      <div className="choice-tiles">
        <Link href={href(null)} className={`choice-tile ${pick === null ? 'on' : ''}`}><b>{all.length}</b><span>ሁሉም አባላት</span></Link>
        {PROGRAM_CODES.map((p) => (
          <Link key={p} href={href(p)} className={`choice-tile ${pick === p ? 'on' : ''}`}>
            <b>{count(p)}</b><span>{ICON[p]} {PROGRAMS[p].label}</span>
            <small>{all.length ? Math.round((count(p) / all.length) * 100) : 0}%</small>
          </Link>
        ))}
        <Link href={href('none')} className={`choice-tile muted-tile ${pick === 'none' ? 'on' : ''}`}><b>{none}</b><span>ምንም ያልመረጡ</span></Link>
      </div>

      <div className="card-head" style={{ marginTop: 12 }}>
        <b>{pick === null ? 'ሁሉም' : pick === 'none' ? 'ምንም ያልመረጡ' : `${ICON[pick]} ${PROGRAMS[pick].label}`}</b>
        <span className="count-badge">{rows.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>አባል</th><th>ፆታ</th><th>ስልክ</th>{PROGRAM_CODES.map((p) => <th key={p} className="num" title={PROGRAMS[p].label}>{ICON[p]} {PROGRAMS[p].label}</th>)}</tr></thead>
          <tbody>
            {rows.map((m, i) => {
              const c = chose(m);
              return (
                <tr key={m.id}>
                  <td className="num">{i + 1}</td>
                  <td><Link className="link" href={`/staff/members/${m.id}`}><b>{m.full_name}</b></Link> <span className="small muted">{m.reg_no}</span></td>
                  <td className="small">{m.sex === 'female' ? 'ሴት' : 'ወንድ'}</td>
                  <td dir="ltr" className="small">{m.phone ?? '—'}</td>
                  {PROGRAM_CODES.map((p) => <td key={p} className="num">{c.includes(p) ? <span className="tick">✓</span> : <span className="muted">—</span>}</td>)}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={4 + PROGRAM_CODES.length} className="muted">ማንም የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
