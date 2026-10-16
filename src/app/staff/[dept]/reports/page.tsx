import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLERGY_RANK, DEPT_NAME, ITEM_CONDITION, STUDY_MODE, formatBirr, type ItemCondition } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { PERIODS, isPeriod, resolveRange, type Period } from '@/lib/periods';
import { loadWallet } from '@/lib/ledger';
import { PrintButton } from '@/components/print-button';
import { StatementHeader, StatementSignatures } from '@/components/statement';

type Prog = { member_id: string; program: string; status: string; decided_at: string | null };
type YR = { member_id: string; decision: string | null; auto_decision: string };

function Tile({ n, t, tone = '', sub }: { n: React.ReactNode; t: string; tone?: string; sub?: string }) {
  return <div className={`rep-tile ${tone}`}><b>{n}</b><span>{t}</span>{sub && <small>{sub}</small>}</div>;
}

/** ኦዲት እና ምርመራ → ሪፖርቶች: one page of counts for the chosen period. */
export default async function AuditReports({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'audit') notFound();
  const sp = await searchParams;
  const period: Period = isPeriod(sp.p) ? sp.p : 'month';
  const supabase = await createClient();
  const { from, to, label } = await resolveRange(supabase, period);
  const inRange = (iso?: string | null) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;

  const [{ data: members }, { data: progs }, { data: deps }, { data: years }, { data: property }, { data: clergy }, wallet] = await Promise.all([
    supabase.from('members').select('id, is_active, created_at'),
    supabase.from('member_programs').select('member_id, program, status, decided_at').in('program', ['course', 'abnet']),
    supabase.from('member_departures').select('member_id, status, decided_at, leave_date, reinstated_at').eq('status', 'approved'),
    supabase.from('academic_years').select('id, ec_year, is_active').order('ec_year', { ascending: false }),
    supabase.from('dept_property').select('qty, price, condition, owner_dept, created_at'),
    supabase.from('clergy').select('rank, member_id'),
    loadWallet(supabase),
  ]);

  // ---------- members & programmes ----------
  const all = (members ?? []) as { id: string; is_active: boolean; created_at: string }[];
  const active = all.filter((m) => m.is_active);
  const activeIds = new Set(active.map((m) => m.id));
  const p = ((progs ?? []) as Prog[]).filter((x) => activeIds.has(x.member_id));
  const course = p.filter((x) => x.program === 'course' && x.status === 'active');
  const abnet = p.filter((x) => x.program === 'abnet' && x.status === 'active');
  const takesCourse = new Set(course.map((x) => x.member_id));
  const notCourse = active.length - takesCourse.size;
  const left = ((deps ?? []) as { member_id: string; decided_at: string | null; leave_date: string; reinstated_at: string | null }[])
    .filter((d) => !d.reinstated_at && inRange(d.decided_at ?? d.leave_date));
  const newMembers = all.filter((m) => inRange(m.created_at)).length;

  // ---------- this academic year ----------
  const year = ((years ?? []) as { id: string; ec_year: number; is_active: boolean }[]).find((y) => y.is_active) ?? (years ?? [])[0];
  const { data: enr } = year
    ? await supabase.from('enrollments').select('member_id, class_level, study_mode').eq('year_id', year.id)
    : { data: [] };
  const enrolled = (enr ?? []) as { member_id: string; class_level: string | null; study_mode: string }[];
  const onsite = enrolled.filter((e) => e.study_mode !== 'distance').length;
  const distance = enrolled.length - onsite;
  const noClass = enrolled.filter((e) => !e.class_level).length;
  const levels = [...new Set(enrolled.map((e) => e.class_level).filter((c): c is string => !!c))];
  const results = year ? (await Promise.all(levels.map(async (lv) => {
    const { data } = await supabase.rpc('year_results', { p_year: year.id, p_class: lv });
    return (data ?? []) as YR[];
  }))).flat() : [];
  const passed = results.filter((r) => (r.decision ?? r.auto_decision) === 'promoted').length;
  const failed = results.filter((r) => (r.decision ?? r.auto_decision) === 'repeat').length;
  const studentsLeft = enrolled.filter((e) => !activeIds.has(e.member_id)).length;

  // ---------- money ----------
  const moves = wallet.movements.filter((m) => inRange(m.date));
  const internal = moves.filter((m) => m.kind === 'income' && m.dept !== 'general').reduce((t, m) => t + m.amount, 0);
  const external = moves.filter((m) => m.kind === 'income' && m.dept === 'general').reduce((t, m) => t + m.amount, 0);
  const refunds = moves.filter((m) => m.kind === 'refund').reduce((t, m) => t + m.amount, 0);
  const spent = moves.filter((m) => m.kind === 'paid').reduce((t, m) => t + m.amount, 0);

  // ---------- property ----------
  const prop = (property ?? []) as { qty: number; price: number | null; condition: ItemCondition; owner_dept: string; created_at: string }[];
  const added = prop.filter((x) => inRange(x.created_at));
  const value = (xs: typeof prop) => xs.reduce((t, x) => t + Number(x.price ?? 0) * x.qty, 0);
  const qty = (xs: typeof prop) => xs.reduce((t, x) => t + x.qty, 0);
  const unusable = prop.filter((x) => x.condition === 'unusable');

  // ---------- clergy ----------
  const cl = (clergy ?? []) as { rank: string; member_id: string | null }[];

  return (
    <div className="statement">
      <div className="page-bar no-print">
        <h2 className="section" style={{ margin: 0 }}>ሪፖርቶች</h2>
        <div className="subtabs">
          {(Object.keys(PERIODS) as Period[]).map((k) => (
            <Link scroll={false} key={k} href={`/staff/audit/reports?p=${k}`} className={`btn sm ${k === period ? 'green' : 'secondary'}`}>{PERIODS[k].label}</Link>
          ))}
        </div>
        <span className="spacer" />
        <PrintButton />
      </div>
      <StatementHeader title="የኦዲት ሪፖርት" subtitle={`${label} · ${formatEc(from)} – ${formatEc(to)}`} />

      <section className="rep-block">
        <h3>👥 አባላትና ምዝገባ</h3>
        <div className="rep-grid">
          <Tile n={active.length} t="ንቁ አባላት" sub={`በዚህ ጊዜ አዲስ፦ ${newMembers}`} />
          <Tile n={course.length} t="ኮርስ የተመዘገቡ" tone="t-blue" />
          <Tile n={abnet.length} t="አብነት የተመዘገቡ" tone="t-blue" />
          <Tile n={notCourse} t="ኮርስ የማይወስዱ" tone="t-gold" sub="ከንቁ አባላት" />
          <Tile n={left.length} t="የለቀቁ (መልቀቂያ)" tone="t-red" sub="በዚህ ጊዜ" />
        </div>
      </section>

      <section className="rep-block">
        <h3>🎓 ተማሪዎች {year ? `— ${year.ec_year} ዓ.ም` : ''}</h3>
        <div className="rep-grid">
          <Tile n={enrolled.length} t="በዓመቱ የገቡ" sub={noClass ? `ክፍል ያልተመደበላቸው፦ ${noClass}` : undefined} />
          <Tile n={onsite} t={`${STUDY_MODE.regular} (በአካል)`} tone="t-blue" />
          <Tile n={distance} t={`${STUDY_MODE.distance} (ኦንላይን)`} tone="t-blue" />
          <Tile n={passed} t="ያለፉ" tone="t-green" sub={results.length ? undefined : 'ውጤት ገና'} />
          <Tile n={failed} t="የወደቁ (ይደግማሉ)" tone="t-red" />
          <Tile n={studentsLeft} t="ያቋረጡ / የወጡ" tone="t-gold" />
        </div>
      </section>

      <section className="rep-block">
        <h3>💵 ገንዘብ <Link className="small link no-print" href={`/staff/audit/money-report?p=${period}`}>ዝርዝር →</Link></h3>
        <div className="rep-grid">
          <Tile n={formatBirr(internal)} t="ገቢ — ከክፍላት (ውስጣዊ)" tone="t-green" />
          <Tile n={formatBirr(external)} t="ገቢ — እርዳታ (ውጫዊ)" tone="t-green" />
          <Tile n={formatBirr(refunds)} t="ተመላሽ" tone="t-green" />
          <Tile n={formatBirr(spent)} t="ወጪ" tone="t-red" />
          <Tile n={formatBirr(internal + external + refunds - spent)} t="የተጣራ (ትርፍ / ኪሳራ)" tone={internal + external + refunds - spent < 0 ? 't-red' : 't-gold'} />
        </div>
      </section>

      <section className="rep-block">
        <h3>📦 ንብረት</h3>
        <div className="rep-grid">
          <Tile n={qty(added)} t="በዚህ ጊዜ የተጨመረ (ብዛት)" tone="t-green" sub={formatBirr(value(added))} />
          <Tile n={qty(unusable)} t={`${ITEM_CONDITION.unusable} (ኪሳራ)`} tone="t-red" sub={formatBirr(value(unusable))} />
          <Tile n={qty(prop)} t="ጠቅላላ ንብረት (ብዛት)" sub={formatBirr(value(prop))} />
        </div>
        {unusable.length > 0 && (
          <p className="small muted">የማያገለግል ንብረት ያላቸው ክፍሎች፦ {[...new Set(unusable.map((x) => DEPT_NAME[x.owner_dept]))].join('፣ ')}</p>
        )}
      </section>

      <section className="rep-block">
        <h3>⛪ ካህናትና ዲያቆናት</h3>
        <div className="rep-grid">
          <Tile n={cl.length} t="ጠቅላላ" />
          {Object.entries(CLERGY_RANK).map(([k, v]) => <Tile key={k} n={cl.filter((c) => c.rank === k).length} t={v} tone="t-blue" />)}
        </div>
      </section>

      <StatementSignatures />
    </div>
  );
}
