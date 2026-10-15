import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, classLabel } from '@/lib/education';
import { STUDY_MODE } from '@/lib/constants';
import { loadTerms } from '@/lib/edu-data';
import { ClassAssigner, type AssignRow } from '@/components/class-assigner';
import { ActionButton } from '@/components/action-button';
import { StudentAttendance } from '@/components/course-attendance-views';
import { carryOverYear } from '@/lib/actions/education-admin';
import { AutoSubmit } from '@/components/auto-submit';

type E = { id: string; member_id: string; class_level: string | null; study_mode: string; self_registered: boolean; members: { full_name: string; reg_no: string } | null };

/** ትምህርት ክፍል: who is in which class this academic year. */
export default async function Classes({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ y?: string; c?: string; v?: string; m?: string; s?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const terms = await loadTerms(supabase, sp.s);
  const { years } = terms;
  const seg = (
    <div className="seg no-print">
      <Link className={sp.v === 'attendance' ? '' : 'on'} href="/staff/education/classes">👥 ተማሪዎች</Link>
      <Link className={sp.v === 'attendance' ? 'on' : ''} href="/staff/education/classes?v=attendance">🧾 ቀሪዎች</Link>
    </div>
  );
  if (sp.v === 'attendance') {
    if (!terms.semester) return <>{seg}<p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p></>;
    return (
      <>
        <div className="page-bar"><h2 className="section" style={{ margin: 0 }}>ክፍሎችና ተማሪዎች</h2>{seg}</div>
        <StudentAttendance supabase={supabase} base="/staff/education/classes" years={years} semesters={terms.semesters}
          semester={terms.semester} cls={sp.c} extra={{ v: 'attendance' }} />
      </>
    );
  }
  const year = years.find((x) => x.id === sp.y) ?? years.find((x) => x.is_active) ?? years[0];
  if (!year) return <p className="muted">መጀመሪያ “የትምህርት ዘመን” ትር ላይ ዓመቱን ይክፈቱ።</p>;
  const { data } = await supabase.from('enrollments')
    .select('id, member_id, class_level, study_mode, self_registered, members(full_name, reg_no)').eq('year_id', year.id);
  const all = ((data ?? []) as unknown as E[]).sort((a, b) => (a.members?.full_name ?? '').localeCompare(b.members?.full_name ?? ''));
  const filter = sp.c ?? 'none';
  const mode = sp.m === 'regular' || sp.m === 'distance' ? sp.m : null;
  const rows = (filter === 'all' ? all : filter === 'none' ? all.filter((e) => !e.class_level) : filter === 'assigned' ? all.filter((e) => e.class_level) : all.filter((e) => e.class_level === filter))
    .filter((e) => !mode || e.study_mode === mode);
  const regular = all.filter((e) => e.study_mode !== 'distance').length;
  const count = (c: string | null) => all.filter((e) => e.class_level === c).length;

  const prevYear = years.filter((x) => x.ec_year < year.ec_year).sort((a, b) => b.ec_year - a.ec_year)[0];
  const assignRows: AssignRow[] = rows.map((e) => ({
    id: e.id, name: e.members?.full_name ?? '', regNo: e.members?.reg_no ?? '', classLevel: e.class_level, mode: e.study_mode, self: e.self_registered,
  }));
  const link = (c: string, m: string | null = mode) => `?y=${year.id}&c=${c}${m ? `&m=${m}` : ''}`;

  const classes: [string, string, number][] = [
    ['none', 'ያልተመደቡ', count(null)],
    ...CLASS_LEVELS.map((c): [string, string, number] => [c, classLabel(c), count(c)]),
    ['assigned', 'የተመደቡ', all.length - count(null)],
    ['all', 'ሁሉም', all.length],
  ];
  const filterName = classes.find((c) => c[0] === filter)?.[1] ?? '';

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ክፍሎችና ተማሪዎች</h2>
        <form className="toolbar slim no-print" action="/staff/education/classes">
          <div className="field">
            <label htmlFor="y">ዓመት</label>
            <select id="y" name="y" defaultValue={year.id}>{years.map((x) => <option key={x.id} value={x.id}>{x.ec_year} ዓ.ም{x.is_active ? ' (ክፍት)' : ''}</option>)}</select>
          </div>
          <AutoSubmit />
        </form>
        {seg}
        <span className="spacer" />
        {prevYear && count(null) > 0 && (
          <ActionButton action={carryOverYear.bind(null, year.id)} label={`↻ በ${prevYear.ec_year} ውሳኔ መድብ`} className="btn sm secondary"
            confirmText={`ያልተመደቡት በ${prevYear.ec_year} ዓ.ም ውሳኔ መሠረት ይመደቡ? ተዛውረዋል → ቀጣዩ ክፍል፣ ይደግማሉ → ያው ክፍል። ቀድሞ የተመደቡት አይነኩም።`} />
        )}
        {filter !== 'none' && rows.length > 0 && (
          <Link className="btn sm secondary" href={`/staff/cards?scope=selected&ids=${rows.slice(0, 150).map((e) => e.member_id).join(',')}`}>🪪 መታወቂያ ({Math.min(rows.length, 150)})</Link>
        )}
      </div>

      <div className="split">
        <aside className="rail no-print" aria-label="ክፍሎች">
          <div className="rail-title">ክፍል</div>
          {classes.map(([k, label, n]) => (
            <Link key={k} href={link(k)} className={`${filter === k ? 'on' : ''} ${k === 'none' && n > 0 ? 'warn' : ''}`}><span>{label}</span><b>{n}</b></Link>
          ))}
          <div className="rail-title">የትምህርት አይነት</div>
          <Link href={link(filter, null)} className={!mode ? 'on' : ''}><span>ሁሉም</span><b>{all.length}</b></Link>
          <Link href={link(filter, 'regular')} className={mode === 'regular' ? 'on' : ''}><span>{STUDY_MODE.regular}</span><b>{regular}</b></Link>
          <Link href={link(filter, 'distance')} className={mode === 'distance' ? 'on' : ''}><span>{STUDY_MODE.distance}</span><b>{all.length - regular}</b></Link>
        </aside>
        <div className="split-main">
          <div className="split-head"><b>{filterName}</b>{mode && <span className="pill">{STUDY_MODE[mode]}</span>}<span className="small muted">{rows.length} ተማሪዎች</span></div>
          <ClassAssigner key={`${year.id}-${filter}`} rows={assignRows} />
          <p className="small muted">ኮርስ የሚወስዱ አባላት (በአቴንዳንስ የተጨመሩ) ያለ ክፍል በራሳቸው ይገባሉ — እዚህ ይመድቧቸው። መምረጥ → <b>መድብ / ቀይር</b> ወይም <b>⬆ ወደ ቀጣይ ክፍል</b> → <b>ተግብር</b>።</p>
        </div>
      </div>
    </>
  );
}
