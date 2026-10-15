import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EC_MONTHS, ecMonthRange, isoToEc, todayIsoAddis, ecToIso, formatEc } from '@/lib/ethiopian-calendar';
import { SESSION_TYPES, DEPT_NAME } from '@/lib/constants';
import { classAbsences, generalAbsences, teacherAbsences, type AbsGroup } from '@/lib/absences';
import { allParticipation, bandOf, loadBands, overall, PART_AREAS, PART_AREA_KEYS, type PartArea, type PartCell } from '@/lib/participation';
import { AbsenceList } from '@/components/absence-list';
import { BandLegend } from '@/components/participation-view';
import { PrintButton } from '@/components/print-button';
import { PopForm } from '@/components/pop-form';
import { DutyPill, type DutyStatus } from '@/components/duty-table';
import { saveBands } from '@/lib/actions/hr-settings';

/** The views: participation % first, then each area's absences (education: course + አብነት; መዝሙር ክፍል: መዝሙር + ወረብ). */
const VIEWS = {
  part: 'የተሳትፎ መቶኛ',
  meeting: 'ስብሰባ',
  course: 'ኮርስ ትምህርት',
  abnet: 'አብነት ትምህርት',
  mezmur: 'መዝሙር ጥናት',
  wereb: 'ወረብ ጥናት',
  duty: 'አገልግሎት ምደባ',
} as const;
type View = keyof typeof VIEWS;
const OWNER: Record<Exclude<View, 'part'>, string> = {
  meeting: 'ሰው ሃብት', course: 'ትምህርት ክፍል', abnet: 'ትምህርት ክፍል', mezmur: 'መዝሙር ክፍል', wereb: 'መዝሙር ክፍል', duty: 'የሚመድቡ ክፍላት',
};

export default async function HrOverview({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ m?: string; y?: string; q?: string; a?: string; who?: string; zema?: string; band?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const sp = await searchParams;
  const now = isoToEc(todayIsoAddis());
  const month = Number(sp.m) || 0;          // 0 = the whole year
  const year = Number(sp.y) || now.year;
  // older links: a=education → course, a=mezmur&zema=wereb → wereb
  const legacy = sp.a === 'education' ? 'course' : sp.a === 'mezmur' && sp.zema === 'wereb' ? 'wereb' : sp.a;
  const view: View = legacy && legacy in VIEWS ? (legacy as View) : 'part';
  const who = sp.who === 'teachers' ? 'teachers' : 'students';
  const band = sp.band === 'vg' || sp.band === 'good' || sp.band === 'poor' ? sp.band : '';
  const from = month ? ecMonthRange(ecToIso({ year, month, day: 1 })).from : ecToIso({ year, month: 1, day: 1 });
  const to = month ? ecMonthRange(ecToIso({ year, month, day: 1 })).to : ecToIso({ year, month: 13, day: 5 });
  const q = sp.q?.trim();
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(month ? { m: String(month) } : {}), y: String(year), ...(q ? { q } : {}), ...extra });
    return `/staff/hr/overview?${p}`;
  };

  const supabase = await createClient();
  const labels = Object.fromEntries(Object.entries(SESSION_TYPES).map(([k, v]) => [k, v.label]));
  let groups: AbsGroup[] = [];
  let error: string | null = null;
  const bands = await loadBands(supabase);

  // ---------- participation table ----------
  type PRow = { id: string; name: string; reg: string; data: Partial<Record<PartArea, PartCell>>; all: number | null };
  let prow: PRow[] = [];
  // ---------- duties ----------
  type DRow = { id: string; member_id: string; dept: string; duty: string; duty_date: string; occasion: string; status: DutyStatus; members: { full_name: string; reg_no: string } | null };
  let duties: { id: string; name: string; reg: string; rows: DRow[] }[] = [];

  try {
    if (view === 'part') {
      const [map, members] = await Promise.all([allParticipation(supabase, from, to), activeMembers(supabase)]);
      prow = members.map((m) => {
        const data = map.get(m.id) ?? {};
        return { id: m.id, name: m.full_name, reg: m.reg_no, data, all: overall(data) };
      });
      if (band) prow = prow.filter((r) => bandOf(r.all, bands)?.key === band);
      prow.sort((a, b) => (a.all ?? 101) - (b.all ?? 101) || a.name.localeCompare(b.name));
    } else if (view === 'duty') {
      const { data, error: e } = await supabase.from('duty_assignments')
        .select('id, member_id, dept, duty, duty_date, occasion, status, members(full_name, reg_no)')
        .gte('duty_date', from).lte('duty_date', to).order('duty_date', { ascending: false }).returns<DRow[]>();
      if (e) throw new Error(e.message);
      const by = new Map<string, DRow[]>();
      for (const r of data ?? []) by.set(r.member_id, [...(by.get(r.member_id) ?? []), r]);
      duties = [...by].map(([id, rows]) => ({ id, name: rows[0].members?.full_name ?? '—', reg: rows[0].members?.reg_no ?? '', rows }))
        .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name));
    } else if (view === 'course') {
      groups = who === 'teachers' ? await teacherAbsences(supabase, { from, to }) : await classAbsences(supabase, { from, to });
    } else {
      groups = await generalAbsences(supabase, [view], from, to, labels);
    }
  } catch (e) { error = (e as Error).message; }
  if (q) {
    const match = (name: string, reg: string) => name.includes(q) || reg.includes(q.toUpperCase());
    groups = groups.filter((g) => match(g.name, g.regNo));
    prow = prow.filter((r) => match(r.name, r.reg));
    duties = duties.filter((r) => match(r.name, r.reg));
  }
  const period = `${month ? `${EC_MONTHS[month - 1]} ${year}` : `${year}`} ዓ.ም`;

  return (
    <>
      <div className="head-row">
        <h2 className="section" style={{ margin: 0 }}>አጠቃላይ አቴንዳንስ</h2>
        <span className="btn-row">
          {view === 'part' && (
            <PopForm label="⚙ የደረጃ መለኪያ" action={saveBands} submitLabel="አስቀምጥ">
              <p className="small muted" style={{ marginTop: 0 }}>የተሳትፎ መቶኛ በምን ያህል “በጣም ጥሩ”፣ “ጥሩ” ወይም “ደካማ” እንደሚባል ይወስኑ።</p>
              <div className="field">
                <label htmlFor="very_good">በጣም ጥሩ — ከ (%) ጀምሮ</label>
                <input id="very_good" name="very_good" type="number" min={1} max={100} defaultValue={bands.very_good} required />
              </div>
              <div className="field">
                <label htmlFor="good">ጥሩ — ከ (%) ጀምሮ</label>
                <input id="good" name="good" type="number" min={0} max={99} defaultValue={bands.good} required />
              </div>
              <p className="small muted">ከ“ጥሩ” በታች ያለው “ደካማ” ይባላል።</p>
            </PopForm>
          )}
          <PrintButton />
        </span>
      </div>

      <div className="seg big no-print" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        {(Object.keys(VIEWS) as View[]).map((k) => (
          <Link key={k} className={view === k ? 'on' : ''} href={keep({ a: k })}>{VIEWS[k]}</Link>
        ))}
      </div>

      <form className="toolbar no-print" action="/staff/hr/overview">
        <input type="hidden" name="a" value={view} />
        {view === 'course' && (
          <div className="field">
            <label htmlFor="who">ማን</label>
            <select id="who" name="who" defaultValue={who}>
              <option value="students">ተማሪዎች</option>
              <option value="teachers">መምህራን</option>
            </select>
          </div>
        )}
        {view === 'part' && (
          <div className="field">
            <label htmlFor="band">ደረጃ</label>
            <select id="band" name="band" defaultValue={band}>
              <option value="">ሁሉም</option>
              <option value="vg">በጣም ጥሩ</option>
              <option value="good">ጥሩ</option>
              <option value="poor">ደካማ</option>
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
        {VIEWS[view]}{view === 'course' ? ` · ${who === 'teachers' ? 'መምህራን' : 'ተማሪዎች'}` : ''}
        {view !== 'part' ? ` · ክትትሉን የሚይዘው ${OWNER[view]}` : ''} · {period}
      </p>
      {error && <div className="alert error">{error}</div>}

      {view === 'part' && (
        <>
          <BandLegend bands={bands} />
          <div className="table-wrap">
            <table className="part-table">
              <thead>
                <tr>
                  <th>አባል</th>
                  {PART_AREA_KEYS.map((a) => <th key={a} className="small" style={{ textAlign: 'center' }}>{PART_AREAS[a]}</th>)}
                  <th style={{ textAlign: 'center' }}>አጠቃላይ</th>
                </tr>
              </thead>
              <tbody>
                {prow.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="link" href={`/staff/members/${r.id}`}><b>{r.name}</b></Link> <span className="small muted">{r.reg}</span></td>
                    {PART_AREA_KEYS.map((a: PartArea) => {
                      const c = r.data[a];
                      const b = bandOf(c?.pct ?? null, bands);
                      return <td key={a} className="pc">{c?.pct !== null && c?.pct !== undefined ? <>{c.pct}%{b && <span className={`band b-${b.key}`}>{b.label}</span>}</> : <span className="muted">—</span>}</td>;
                    })}
                    <td className="pc"><b>{r.all !== null ? `${r.all}%` : '—'}</b>{(() => { const b = bandOf(r.all, bands); return b && <span className={`band b-${b.key}`}>{b.label}</span>; })()}</td>
                  </tr>
                ))}
                {prow.length === 0 && <tr><td colSpan={PART_AREA_KEYS.length + 2} className="muted">ምንም አልተገኘም።</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="small muted">“—” = በዚያ ዘርፍ አይሳተፍም (ወይም እስካሁን አልተመዘገበም)። መዝሙር፣ ወረብና አብነት አንድም ጊዜ ያልተገኘ አባል እንደማይሳተፍ ይቆጠራል። ምደባ የሚቆጠረው ክፍሉ ካረጋገጠው በኋላ ነው። “አጠቃላይ” የሚሳተፍባቸው ዘርፎች አማካይ ነው።</p>
        </>
      )}

      {view === 'duty' && (
        duties.length === 0 ? <p className="muted card">በዚህ ጊዜ ምደባ የለም።</p> : (
          <div className="abs-list">
            <div className="abs-head"><span>አባል</span><span className="num">ምደባ</span><span className="num">ፈጽሟል / አልፈጸመም</span></div>
            {duties.map((g) => {
              const done = g.rows.filter((r) => r.status === 'done').length;
              const missed = g.rows.filter((r) => r.status === 'missed').length;
              return (
                <details key={g.id} className="abs-row">
                  <summary>
                    <span><b>{g.name}</b> <span className="small muted">{g.reg}</span></span>
                    <span className="num"><span className="abs-count">{g.rows.length}</span></span>
                    <span className="num small">{done} / <span className={missed ? 'neg' : ''}>{missed}</span></span>
                  </summary>
                  <table>
                    <thead><tr><th>ቀን</th><th>ምድብ</th><th>ምክንያት</th><th>የመደበው</th><th>ሁኔታ</th></tr></thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{formatEc(r.duty_date, { weekday: true })}</td><td>{r.duty}</td><td>{r.occasion}</td>
                          <td className="small">{DEPT_NAME[r.dept]}</td><td><DutyPill status={r.status} date={r.duty_date} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              );
            })}
          </div>
        )
      )}

      {view !== 'part' && view !== 'duty' && (
        <AbsenceList groups={groups}
          halfLabel={view === 'course' && who === 'teachers' ? 'አርፍዷል' : 'ግማሽ'}
          whatLabel={VIEWS[view]} />
      )}
    </>
  );
}

async function activeMembers(supabase: Awaited<ReturnType<typeof createClient>>) {
  const out: { id: string; full_name: string; reg_no: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from('members').select('id, full_name, reg_no').eq('is_active', true)
      .order('full_name').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
