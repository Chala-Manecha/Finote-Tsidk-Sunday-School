import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, classLabel } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { ClassAssigner, type AssignRow } from '@/components/class-assigner';
import { ActionButton } from '@/components/action-button';
import { SegLinks } from '@/components/seg-links';
import { StudentAttendance } from '@/components/course-attendance-views';
import { enrollAllMembers, carryOverYear } from '@/lib/actions/education-admin';

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
  const seg = <SegLinks current={sp.v === 'attendance' ? 'att' : 'list'} items={[['list', '👥 ተማሪዎችና ክፍሎች', '/staff/education/classes'], ['att', '🧾 የተማሪዎች ክትትል (ቀሪዎች)', '/staff/education/classes?v=attendance']]} />;
  if (sp.v === 'attendance') {
    if (!terms.semester) return <>{seg}<p className="muted">የትምህርት ዘመን ገና አልተከፈተም።</p></>;
    return (
      <>
        {seg}
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

  return (
    <>
      {seg}
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>ክፍሎችና ተማሪዎች — {year.ec_year} ዓ.ም</h2>
        <form className="btn-row no-print" action="/staff/education/classes">
          <select name="y" defaultValue={year.id} aria-label="ዓመት">{years.map((x) => <option key={x.id} value={x.id}>{x.ec_year} ዓ.ም</option>)}</select>
          <button className="btn sm secondary">ቀይር</button>
        </form>
      </div>

      <section className="card setup-steps">
        <b>የዓመቱ ዝግጅት</b>
        <ol>
          {prevYear && (
            <li>
              <ActionButton action={carryOverYear.bind(null, year.id)} label={`በ${prevYear.ec_year} ዓ.ም ውሳኔ መሠረት መድብ`} className="btn sm green"
                confirmText={`ተዛውረዋል → ቀጣዩ ክፍል፣ ይደግማሉ → ያው ክፍል። መደበኛ/የሳምንት መጨረሻ እንዳለ ይቆያል። ቀድሞ የተመደቡት አይነኩም። ይቀጥል?`} />
              <span className="small muted"> ባለፈው ዓመት የነበሩ ተማሪዎችን በዓመት ማጠቃለያው ውሳኔ ያስገባል።</span>
            </li>
          )}
          <li>
            <ActionButton action={enrollAllMembers.bind(null, year.id)} label="ኮርስ የሚወስዱትን አስገባ" className="btn sm secondary"
              confirmText={`ኮርስ የመረጡና በተሳታፊዎች የተጨመሩ፣ በ${year.ec_year} ዓ.ም ገና ያልገቡ አባላት (ያልተመደቡ ሆነው) ይግቡ?`} />
            <span className="small muted"> ኮርስ የሚወስዱ (በተሳታፊዎች የተጨመሩ) ገና ያልገቡትን ያለ ክፍል ያስገባል።</span>
          </li>
          <li><span className="small">ከታች ተማሪዎችን ምረጥ → <b>መድብ / ቀይር</b> ወይም <b>⬆ ወደ ቀጣይ ክፍል አሳልፍ</b> ምረጥ → <b>ለተመረጡት ተግብር</b>። ለአንድ ተማሪ ብቻ በረድፉ ላይ ያለውን <b>⬆ አሳልፍ</b> ይጫኑ።</span></li>
        </ol>
      </section>

      <div className="stat-cards no-print">
        <Link className={`stat-card ${!mode ? 'on' : ''}`} href={link(filter, null)}><b>{all.length}</b>ሁሉም ተማሪዎች</Link>
        <Link className={`stat-card ${mode === 'regular' ? 'on' : ''}`} href={link(filter, 'regular')}><b>{regular}</b>መደበኛ</Link>
        <Link className={`stat-card ${mode === 'distance' ? 'on' : ''}`} href={link(filter, 'distance')}><b>{all.length - regular}</b>የሳምንት መጨረሻ</Link>
        <Link className="stat-card" href={link('none')}><b>{count(null)}</b>ያልተመደቡ</Link>
      </div>
      <div className="subtabs no-print" style={{ marginTop: 10 }}>
        <a className={`btn sm ${filter === 'none' ? 'green' : 'secondary'}`} href={link('none')}>ያልተመደቡ ({count(null)})</a>
        {CLASS_LEVELS.map((c) => (
          <a key={c} className={`btn sm ${filter === c ? 'green' : 'secondary'}`} href={link(c)}>{classLabel(c)} ({count(c)})</a>
        ))}
        <a className={`btn sm ${filter === 'assigned' ? 'green' : 'secondary'}`} href={link('assigned')}>የተመደቡ ({all.length - count(null)})</a>
        <a className={`btn sm ${filter === 'all' ? 'green' : 'secondary'}`} href={link('all')}>ሁሉም ({all.length})</a>
      </div>
      {filter !== 'none' && rows.length > 0 && (
        <div className="btn-row no-print" style={{ justifyContent: 'flex-end' }}>
          <Link className="btn sm secondary" href={`/staff/cards?scope=selected&ids=${rows.slice(0, 150).map((e) => e.member_id).join(',')}`}>
            🪪 የ{filter === 'all' ? 'ሁሉም' : filter === 'assigned' ? 'የተመደቡ' : classLabel(filter)} መታወቂያ ({Math.min(rows.length, 150)})
          </Link>
        </div>
      )}
      <ClassAssigner key={`${year.id}-${filter}`} rows={assignRows} />
      <p className="small muted">የሳምንት መጨረሻ ተማሪዎች ዝቅተኛ የክትትል ግዴታቸው በ“የትምህርት ዘመን” ትር ይወሰናል። የክፍል መምህራን በዚያው ክፍል ተማሪ ሆነው መመዝገብ የለባቸውም።</p>
    </>
  );
}
