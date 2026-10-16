import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STUDY_MODE, programsForDept } from '@/lib/constants';
import { CLASS_LEVELS, classLabel } from '@/lib/education';
import { formatEc } from '@/lib/ethiopian-calendar';
import { loadTerms } from '@/lib/edu-data';
import { StudentAttendance } from '@/components/course-attendance-views';
import { PrintButton } from '@/components/print-button';

type Prog = { member_id: string; status: 'chosen' | 'active' | 'declined'; decided_at: string | null; members: { full_name: string; reg_no: string; phone: string | null } };
type Enr = { member_id: string; class_level: string | null; study_mode: string; members: { full_name: string; reg_no: string; phone: string | null } | null };

/**
 * ተማሪዎች.
 * ትምህርት ክፍል: members who chose ኮርስ — without a class / with their class — and their attendance.
 * መዝሙር ክፍል: members who chose መዝሙርና ወረብ.
 */
export default async function Participants({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ v?: string; q?: string; c?: string; s?: string }>;
}) {
  const { dept } = await params;
  const programs = programsForDept(dept);
  if (programs.length === 0) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const base = `/staff/${dept}/participants`;
  const q = sp.q?.trim();
  const match = (m: { full_name: string; reg_no: string } | null) => !q || !!m && (m.full_name.includes(q) || m.reg_no.includes(q.toUpperCase()));
  const search = (
    <form className="toolbar slim no-print" action={base}>
      {sp.c && <input type="hidden" name="c" value={sp.c} />}
      <input name="q" type="search" defaultValue={q} placeholder="🔍 ስም / ቁጥር" aria-label="ፈልግ" style={{ width: 170 }} />
    </form>
  );

  if (dept === 'mezmur') {
    const { data } = await supabase.from('member_programs')
      .select('member_id, status, decided_at, members!inner(full_name, reg_no, phone, is_active)')
      .eq('program', 'mezmur').eq('status', 'active').eq('members.is_active', true).returns<Prog[]>();
    const rows = (data ?? []).filter((r) => match(r.members)).sort((a, b) => a.members.full_name.localeCompare(b.members.full_name, 'am'));
    return (
      <>
        <div className="page-bar"><h2 className="section" style={{ margin: 0 }}>ተማሪዎች</h2><span className="count-badge">{rows.length}</span><span className="spacer" />{search}<PrintButton /></div>
        <p className="small muted">“መዝሙርና ወረብ”ን የመረጡ አባላት — በክትትል ዝርዝሩ በራሳቸው ይገባሉ።</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>አባል</th><th>ስልክ</th><th>የመረጡበት</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.member_id}>
                  <td className="num">{i + 1}</td>
                  <td><b>{r.members.full_name}</b> <span className="small muted">{r.members.reg_no}</span></td>
                  <td dir="ltr" className="small">{r.members.phone ?? '—'}</td>
                  <td className="small">{r.decided_at ? formatEc(r.decided_at.slice(0, 10)) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="muted">ማንም የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ---------- ትምህርት ክፍል (ኮርስ) ----------
  const terms = await loadTerms(supabase, sp.s);
  const seg = (
    <div className="seg no-print">
      <Link className={sp.v === 'attendance' ? '' : 'on'} href={base}>👥 ተማሪዎች</Link>
      <Link className={sp.v === 'attendance' ? 'on' : ''} href={`${base}?v=attendance`}>🧾 ክትትል</Link>
    </div>
  );
  if (sp.v === 'attendance') {
    return (
      <>
        <div className="page-bar"><h2 className="section" style={{ margin: 0 }}>ተማሪዎች</h2>{seg}</div>
        {terms.semester
          ? <>
              <p className="small muted">መምህራን በየክፍለ ጊዜው የሚይዙት ክትትል በአንድ ላይ።</p>
              <StudentAttendance supabase={supabase} base={base} years={terms.years} semesters={terms.semesters}
                semester={terms.semester} cls={sp.c} extra={{ v: 'attendance' }} />
            </>
          : <p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p>}
      </>
    );
  }
  const year = terms.years.find((y) => y.is_active) ?? terms.years[0];
  const [{ data: enr }, { data: chose }] = await Promise.all([
    year ? supabase.from('enrollments').select('member_id, class_level, study_mode, members(full_name, reg_no, phone)').eq('year_id', year.id)
      : Promise.resolve({ data: [] }),
    supabase.from('member_programs').select('member_id, status, decided_at, members!inner(full_name, reg_no, phone, is_active)')
      .eq('program', 'course').eq('status', 'active').eq('members.is_active', true).returns<Prog[]>(),
  ]);
  const all = ((enr ?? []) as unknown as Enr[]).filter((e) => match(e.members))
    .sort((a, b) => (a.members?.full_name ?? '').localeCompare(b.members?.full_name ?? '', 'am'));
  const inYear = new Set(all.map((e) => e.member_id));
  const notEnrolled = (chose ?? []).filter((r) => !inYear.has(r.member_id) && match(r.members));
  const none = all.filter((e) => !e.class_level);
  const order = (c: string | null) => CLASS_LEVELS.indexOf((c ?? '') as (typeof CLASS_LEVELS)[number]);
  const cls = sp.c && CLASS_LEVELS.includes(sp.c as (typeof CLASS_LEVELS)[number]) ? sp.c : null;
  const placed = all.filter((e) => e.class_level && (!cls || e.class_level === cls))
    .sort((a, b) => order(a.class_level) - order(b.class_level) || (a.members?.full_name ?? '').localeCompare(b.members?.full_name ?? '', 'am'));
  const levels = CLASS_LEVELS.filter((c) => all.some((e) => e.class_level === c));

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ተማሪዎች</h2>
        {seg}
        <span className="spacer" />
        {year && <span className="small muted">{year.ec_year} ዓ.ም</span>}
        {search}
        <PrintButton />
      </div>
      <p className="small muted">“ኮርስ” የመረጡ አባላት በዚህ ዓመት ያለ ክፍል በራሳቸው ይገባሉ። ክፍል በ“ክፍላት” ትር ይመደባል፤ ክፍሉ ኮርሶች አሉት፣ ኮርሶቹ መምህራን አሏቸው።</p>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <b>ክፍል ያልተመደበላቸው</b><span className={`count-badge ${none.length ? 'warn' : ''}`}>{none.length}</span>
            <span className="spacer" />
            {none.length > 0 && <Link className="btn sm no-print" href={year ? `/staff/education/classes?y=${year.id}&c=none` : '/staff/education/classes'}>ክፍል መድብ →</Link>}
          </div>
          <ul className="plain-list">
            {none.map((e) => (
              <li key={e.member_id}><b>{e.members?.full_name}</b> <span className="small muted">{e.members?.reg_no} · {STUDY_MODE[e.study_mode as keyof typeof STUDY_MODE] ?? ''}</span></li>
            ))}
            {none.length === 0 && <li className="muted">ሁሉም ክፍል ተመድቦላቸዋል።</li>}
          </ul>
          {notEnrolled.length > 0 && (
            <details className="fold-card" style={{ marginTop: 10 }}>
              <summary className="small"><b>ኮርስ የመረጡ፣ ዓመቱ ገና ያልተከፈተላቸው ({notEnrolled.length})</b></summary>
              <p className="small" style={{ marginBottom: 0 }}>{notEnrolled.map((r) => r.members.full_name).join('፣ ')} — የትምህርት ዘመኑ ሲከፈት በራሳቸው ይገባሉ።</p>
            </details>
          )}
        </section>

        <section className="card">
          <div className="card-head"><b>ክፍል የተመደበላቸው</b><span className="count-badge">{placed.length}</span></div>
          {levels.length > 1 && (
            <div className="chip-row no-print">
              <Link className={`chip ${!cls ? 'on' : ''}`} href={`${base}${q ? `?q=${encodeURIComponent(q)}` : ''}`}>ሁሉም</Link>
              {levels.map((c) => <Link key={c} className={`chip ${cls === c ? 'on' : ''}`} href={`${base}?c=${c}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>{classLabel(c)}</Link>)}
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>ተማሪ</th><th>ክፍል</th><th>አይነት</th><th>ስልክ</th></tr></thead>
              <tbody>
                {placed.map((e, i) => (
                  <tr key={e.member_id}>
                    <td className="num">{i + 1}</td>
                    <td><b>{e.members?.full_name}</b> <span className="small muted">{e.members?.reg_no}</span></td>
                    <td><span className="pill">{classLabel(e.class_level!)}</span></td>
                    <td className="small">{STUDY_MODE[e.study_mode as keyof typeof STUDY_MODE] ?? e.study_mode}</td>
                    <td dir="ltr" className="small">{e.members?.phone ?? '—'}</td>
                  </tr>
                ))}
                {placed.length === 0 && <tr><td colSpan={5} className="muted">ገና ክፍል የተመደበለት የለም።</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
