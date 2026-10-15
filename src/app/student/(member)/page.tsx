import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import {
  COMPONENTS, DECISION, READY_MESSAGE, THANKSGIVING, classLabel, gradeOf, semesterLabel,
  type AcademicYear, type ResultRow, type Semester, type YearRow,
} from '@/lib/education';
import { ActionButton } from '@/components/action-button';
import { enrollSelf } from '@/lib/actions/student-auth';
import { ownPhoto } from '@/lib/member-photo';
import { DEPT_NAME, EVENT_KINDS, type Delivery } from '@/lib/constants';
import { DeliveryBadge } from '@/components/delivery-badge';
import { fixedSchedules } from '@/lib/schedules';
import { dayNames } from '@/components/day-checks';
import { ecToIso, formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { PART_AREAS, bandOf, loadBands, memberParticipation, overall, type PartArea } from '@/lib/participation';
import { BandLegend, ParticipationView } from '@/components/participation-view';
import { DutyPill, type DutyStatus } from '@/components/duty-table';

type Duty = { id: string; dept: string; duty: string; duty_date: string; occasion: string; status: DutyStatus };
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type Absence = { on_date: string; area: PartArea; label: string; status: 'absent' | 'half' };


export default async function StudentHome() {
  const me = await requireMember();
  const supabase = await createClient();
  const ecYear = isoToEc(todayIsoAddis()).year;
  const yearFrom = ecToIso({ year: ecYear, month: 1, day: 1 });
  const [{ data: prof }, part, bands, { data: dutyData }, { data: absData }, photo] = await Promise.all([
    supabase.rpc('my_member_profile'),
    memberParticipation(supabase, me.memberId, yearFrom),
    loadBands(supabase),
    supabase.rpc('my_duties'),
    supabase.rpc('member_absences', { p_member: me.memberId, p_limit: 8 }),
    ownPhoto(me.photoPath),
  ]);
  const p = ((prof ?? []) as { sex: 'male' | 'female' | null; joined_year: number | null }[])[0];
  const female = p?.sex === 'female';
  const first = me.fullName.replace(/^(ቀሲስ|ዲያቆን|ዶክተር|መምህር|መምህርት) /, '').split(' ')[0];
  const duties = (dutyData ?? []) as Duty[];
  const today = todayIsoAddis();
  const upcoming = duties.filter((d) => d.duty_date >= today).reverse();
  const pastDuties = duties.filter((d) => d.duty_date < today);
  const absences = (absData ?? []) as Absence[];
  const all = overall(part);
  const allBand = bandOf(all, bands);
  const { data: yearData } = await supabase.from('academic_years').select('id, ec_year, is_active').eq('is_active', true).maybeSingle();
  const year = yearData as AcademicYear | null;

  const [{ data: semData }, { data: enr }] = await Promise.all([
    year ? supabase.from('semesters').select('*').eq('year_id', year.id).order('no') : Promise.resolve({ data: [] }),
    year ? supabase.from('enrollments').select('class_level').eq('year_id', year.id).eq('member_id', me.memberId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const semesters = (semData ?? []) as Semester[];
  const classLevel = (enr as { class_level: string | null } | null)?.class_level ?? null;

  // This week's schedule for what the member takes part in (with the join link when online).
  const { data: myProgs } = await supabase.from('member_programs').select('program, status').eq('member_id', me.memberId);
  const takes = (p: string) => (myProgs ?? []).some((x) => x.program === p && x.status === 'active');
  const [{ data: weekEvents }, fixed, { data: abnet }, { data: myCourses }] = await Promise.all([
    supabase.from('events').select('id, title, event_date, event_time, kind, place, mode, platform, link').eq('status', 'approved')
      .gte('event_date', today).lte('event_date', addDaysIso(today, 7)).order('event_date').order('event_time'),
    takes('mezmur') ? fixedSchedules(supabase, { dept: 'mezmur', withLink: true }) : Promise.resolve([]),
    takes('abnet') ? supabase.from('abnet_sessions').select('id, subject, teacher, day_text, time_text, mode, platform, link') : Promise.resolve({ data: [] }),
    classLevel && year
      ? supabase.from('course_offerings').select('id, name, days, time_text, mode, platform, link, semesters!inner(is_active, year_id)')
          .eq('class_level', classLevel).eq('semesters.year_id', year.id).eq('semesters.is_active', true)
      : Promise.resolve({ data: [] }),
  ]);
  type Item = { key: string; title: string; when: string; d: Partial<Delivery>; place?: string | null };
  const schedule: Item[] = [
    ...(weekEvents ?? []).filter((e) => !e.kind || e.kind === 'meeting' || (e.kind === 'wereb' ? takes('mezmur') : takes(e.kind)))
      .map((e) => ({ key: e.id, title: `${e.kind ? `${EVENT_KINDS[e.kind]}፦ ` : ''}${e.title}`, when: `${formatEc(e.event_date, { weekday: true })} · ${e.event_time.slice(0, 5)}`, d: e as Partial<Delivery>, place: e.place })),
    ...(myCourses ?? []).map((c) => ({ key: c.id, title: `ኮርስ፦ ${c.name}`, when: [c.days?.length ? dayNames(c.days) : '', c.time_text].filter(Boolean).join(' · ') || 'ቋሚ', d: c as Partial<Delivery> })),
    ...(abnet ?? []).map((a) => ({ key: a.id, title: `አብነት፦ ${a.subject ?? ''}`, when: [a.day_text, a.time_text].filter(Boolean).join(' · '), d: a as Partial<Delivery> })),
    ...fixed.map((f) => ({ key: f.id, title: f.title, when: [f.day_text, f.time_text].filter(Boolean).join(' · '), d: f, place: f.place })),
  ];

  const results = classLevel
    ? await Promise.all(semesters.map(async (s) => {
        const { data } = await supabase.rpc('semester_results', { p_semester: s.id, p_class: classLevel });
        return { s, rows: (data ?? []) as ResultRow[] };
      }))
    : [];

  const yearRow = classLevel && year
    ? (((await supabase.rpc('year_results', { p_year: year.id, p_class: classLevel })).data ?? []) as YearRow[])[0]
    : undefined;

  return (
    <>
      <section className="me-hero">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="me-photo" src={photo} alt="" />
          : <span className="me-photo empty" aria-hidden>{first.slice(0, 1)}</span>}
        <div className="me-hello">
          <span className="small">{female ? 'ሰላም እህታችን' : 'ሰላም ወንድማችን'}</span>
          <h1 className="serif">{me.fullName}</h1>
          <p>{female ? `እንኳን ደህና መጣሽ፤ ${first}! በአገልግሎትሽ እግዚአብሔር ይባርክሽ።` : `እንኳን ደህና መጣህ፤ ${first}! በአገልግሎትህ እግዚአብሔር ይባርክህ።`}</p>
          <div className="me-tags">
            <span>መለያ ቁ. <b>{me.regNo}</b></span>
            {p?.joined_year && <span>ከ{p.joined_year} ዓ.ም ጀምሮ</span>}
          </div>
        </div>
        <div className="me-stats">
          <div><b>{all !== null ? `${all}%` : '—'}</b><span>ተሳትፎ ({ecYear}){allBand && <em className={`band b-${allBand.key}`}>{allBand.label}</em>}</span></div>
          <div><b>{duties.filter((d) => d.status === 'done').length}<small>/{duties.length}</small></b><span>የፈጸምኳቸው ምደባዎች</span></div>
          <div><b>{upcoming.length}</b><span>የሚመጡ ምደባዎች</span></div>
        </div>
      </section>

      <div className="me-grid">
        <section className="card">
          <h2 className="section" style={{ marginTop: 0 }}>የእኔ ተሳትፎ — {ecYear} ዓ.ም</h2>
          <ParticipationView data={part} bands={bands} compact />
          <BandLegend bands={bands} />
        </section>

        <section className="card">
          <h2 className="section" style={{ marginTop: 0 }}>የእኔ መርሐ ግብሮች</h2>
          {schedule.length === 0 ? <p className="muted small">በዚህ ሳምንት የተያዘ መርሐ ግብር የለም።</p> : (
            <ul className="me-list">
              {schedule.map((x) => (
                <li key={x.key}>
                  <span><b>{x.title}</b><br /><span className="small muted">{x.when}{x.place ? ` · 📍 ${x.place}` : ''}</span></span>
                  <DeliveryBadge d={x.d} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="section" style={{ marginTop: 0 }}>የተመደብኩባቸው አገልግሎቶች</h2>
          {duties.length === 0 ? <p className="muted small">እስካሁን የተመደቡበት አገልግሎት የለም።</p> : (
            <ul className="me-list">
              {[...upcoming, ...pastDuties.slice(0, 8)].map((d) => (
                <li key={d.id}>
                  <span><b>{d.duty}</b> · {d.occasion}<br /><span className="small muted">{formatEc(d.duty_date, { weekday: true })} · {DEPT_NAME[d.dept]}</span></span>
                  <DutyPill status={d.status} date={d.duty_date} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="section" style={{ marginTop: 0 }}>የቀረሁባቸው ቀናት</h2>
          {absences.length === 0 ? <p className="muted small">የቀሩበት ቀን የለም። በርቱ!</p> : (
            <ul className="me-list">
              {absences.map((a, i) => (
                <li key={i}>
                  <span>{PART_AREAS[a.area] ?? a.area}{a.label ? ` — ${a.label}` : ''}<br /><span className="small muted">{formatEc(a.on_date, { weekday: true })}</span></span>
                  <span className="pill absent">{a.status === 'half' ? (a.area === 'teaching' ? 'አርፍዷል' : 'ግማሽ') : 'ቀሪ'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <h2 className="section">የእኔ ትምህርት</h2>
      {!year && <p className="muted">የትምህርት ዘመኑ ገና አልተከፈተም።</p>}
      {year && !enr && (
        <div className="card">
          <p style={{ marginTop: 0 }}>ለ{year.ec_year} ዓ.ም የትምህርት ዘመን አልተመዘገቡም።</p>
          <ActionButton action={enrollSelf} label={`ለ${year.ec_year} ዓ.ም ተመዝገብ`} className="btn" />
        </div>
      )}
      {year && enr && !classLevel && (
        <p className="alert ok">ለ{year.ec_year} ዓ.ም ተመዝግበዋል። ክፍልዎን ትምህርት ክፍል በቅርቡ ይመድባል።</p>
      )}

      {classLevel && <p><b>{classLabel(classLevel)}</b> · {year?.ec_year} ዓ.ም</p>}
      {yearRow?.ready && (
        <section className="card" style={{ marginBottom: 16, borderColor: 'var(--gold)' }}>
          <h3 style={{ marginTop: 0 }}>የ{year?.ec_year} ዓ.ም የዓመት ውጤት</h3>
          <div className="alert ok">
            <div><b>{READY_MESSAGE}</b></div>
            <div className="serif">{THANKSGIVING}</div>
          </div>
          <p>
            የዓመት አማካይ፦ <b>{yearRow.year_average}</b> · ደረጃ በክፍል፦ <b>{yearRow.rank} ከ{yearRow.class_size}</b> · ውሳኔ፦{' '}
            <b className={yearRow.decision === 'repeat' ? 'neg' : 'pos'}>{yearRow.decision ? DECISION[yearRow.decision] : '—'}</b>
            {yearRow.rank !== null && yearRow.rank <= 3 && ' 🏅'}
          </p>
        </section>
      )}
      {results.map(({ s, rows }) => (
        <section key={s.id} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{semesterLabel(s.no)}</h3>
          {rows.length > 0 && rows[0].ready && (
            <div className="alert ok">
              <div><b>{READY_MESSAGE}</b></div>
              <div className="serif">{THANKSGIVING}</div>
            </div>
          )}
          <p className="small muted">
            የውጤት አያያዝ፦ ፈተና {s.w_quiz} · ደብተር {s.w_notebook} · ተሣትፎ {s.w_participation} · አጋማሽ {s.w_mid} · ዋና {s.w_final} = 100 · ማለፊያ {s.pass_mark}
          </p>
          {rows.length === 0 ? <p className="muted">ለዚህ ሴሚስተር ኮርሶች ገና አልተዘጋጁም።</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>ኮርስ</th>{COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}</th>)}<th className="num">ድምር</th><th>ደረጃ</th><th className="num">ክትትል</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.offering_id}>
                      <td>{r.course}</td>
                      {r.status === 'approved'
                        ? <>{COMPONENTS.map((c) => <td key={c.key} className="num">{r[c.key] ?? '—'}</td>)}
                            <td className="num"><b>{r.total}</b></td><td>{gradeOf(Number(r.total), s.pass_mark).label}</td></>
                        : <td colSpan={COMPONENTS.length + 2} className="muted small">ውጤቱ ገና አልጸደቀም።</td>}
                      <td className="num">{r.sessions ? `${Math.round((r.attended / r.sessions) * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && rows[0].ready && (
            <p><b>አማካይ፦</b> {rows[0].average} · <b>ደረጃ በክፍል፦</b> {rows[0].rank} ከ{rows[0].class_size}</p>
          )}
        </section>
      ))}
    </>
  );
}
