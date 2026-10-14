import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EC_MONTHS, ecMonthRange, isoToEc, todayIsoAddis, ecToIso } from '@/lib/ethiopian-calendar';
import { SESSION_TYPES } from '@/lib/constants';
import { classAbsences, generalAbsences, teacherAbsences, type AbsGroup } from '@/lib/absences';
import { AbsenceList } from '@/components/absence-list';
import { PrintButton } from '@/components/print-button';

const AREAS = { meeting: 'ስብሰባ', education: 'ትምህርት ክፍል (ኮርስ)', mezmur: 'መዝሙር ክፍል (ዜማ)' } as const;
type Area = keyof typeof AREAS;

/** HR: who was absent, per area — one row per member with the number of absent days; open a row for the dates. */
export default async function HrOverview({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ m?: string; y?: string; q?: string; a?: string; who?: string; zema?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const sp = await searchParams;
  const now = isoToEc(todayIsoAddis());
  const month = Number(sp.m) || 0;          // 0 = the whole year
  const year = Number(sp.y) || now.year;
  const area: Area = sp.a && sp.a in AREAS ? (sp.a as Area) : 'meeting';
  const who = sp.who === 'teachers' ? 'teachers' : 'students';
  const zema = sp.zema === 'mezmur' || sp.zema === 'wereb' ? sp.zema : 'all';
  const from = month ? ecMonthRange(ecToIso({ year, month, day: 1 })).from : ecToIso({ year, month: 1, day: 1 });
  const to = month ? ecMonthRange(ecToIso({ year, month, day: 1 })).to : ecToIso({ year, month: 13, day: 5 });

  const supabase = await createClient();
  const labels = Object.fromEntries(Object.entries(SESSION_TYPES).map(([k, v]) => [k, v.label]));
  let groups: AbsGroup[] = [];
  let error: string | null = null;
  try {
    if (area === 'meeting') groups = await generalAbsences(supabase, ['meeting'], from, to, labels);
    else if (area === 'mezmur') groups = await generalAbsences(supabase, zema === 'all' ? ['mezmur', 'wereb'] : [zema], from, to, labels);
    else groups = who === 'teachers' ? await teacherAbsences(supabase, { from, to }) : await classAbsences(supabase, { from, to });
  } catch (e) { error = (e as Error).message; }
  const q = sp.q?.trim();
  if (q) groups = groups.filter((g) => g.name.includes(q) || g.regNo.includes(q.toUpperCase()));

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>አጠቃላይ አቴንዳንስ</h2>
        <PrintButton />
      </div>
      <form className="toolbar no-print" action="/staff/hr/overview">
        <div className="field">
          <label htmlFor="a">ዘርፍ</label>
          <select id="a" name="a" defaultValue={area}>
            {(Object.keys(AREAS) as Area[]).map((k) => <option key={k} value={k}>{AREAS[k]}</option>)}
          </select>
        </div>
        {area === 'education' && (
          <div className="field">
            <label htmlFor="who">ማን</label>
            <select id="who" name="who" defaultValue={who}>
              <option value="students">ተማሪዎች</option>
              <option value="teachers">መምህራን</option>
            </select>
          </div>
        )}
        {area === 'mezmur' && (
          <div className="field">
            <label htmlFor="zema">ዜማ</label>
            <select id="zema" name="zema" defaultValue={zema}>
              <option value="all">ሁሉም</option>
              <option value="mezmur">መዝሙር</option>
              <option value="wereb">ወረብ</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="m">ወር</label>
          <select id="m" name="m" defaultValue={month}>
            <option value={0}>ዓመቱን በሙሉ</option>
            {EC_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="y">ዓ.ም</label>
          <input id="y" name="y" type="number" defaultValue={year} style={{ width: 100 }} />
        </div>
        <div className="field">
          <label htmlFor="q">ስም</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="ፈልግ…" />
        </div>
        <button className="btn sm">አሳይ</button>
      </form>
      <p className="muted small">
        {AREAS[area]}{area === 'education' ? ` · ${who === 'teachers' ? 'መምህራን' : 'ተማሪዎች'}` : ''}{area === 'mezmur' && zema !== 'all' ? ` · ${zema === 'mezmur' ? 'መዝሙር' : 'ወረብ'}` : ''}
        {' · '}{month ? `${EC_MONTHS[month - 1]} ${year}` : `${year}`} ዓ.ም
      </p>
      {error && <div className="alert error">{error}</div>}
      <AbsenceList groups={groups}
        halfLabel={area === 'education' && who === 'teachers' ? 'አርፍዷል' : 'ግማሽ'}
        whatLabel={area === 'meeting' ? 'ስብሰባ' : area === 'mezmur' ? 'ዜማ' : 'ኮርስ'} />
    </>
  );
}
