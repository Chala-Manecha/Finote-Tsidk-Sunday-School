import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import Link from 'next/link';
import { ageFromIso, formatEc } from '@/lib/ethiopian-calendar';
import { GEEZ_LEVEL, SEX } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-button';
import { PrintButton } from '@/components/print-button';
import { AbnetTabs } from '@/components/abnet-tabs';
import { EcDatePicker } from '@/components/ec-date-picker';
import { AbnetFields, AbnetTable, type Abnet, ABNET_COLS_LINK } from '@/components/education-views';
import { saveAbnet } from '@/lib/actions/education';
import { deleteClergy, saveClergy } from '@/lib/actions/clergy';

const RANK: Record<string, string> = { deacon: 'ዲያቆን', priest: 'ቄስ / ካህን', other: 'ሌላ' };
const SERVICE: Record<string, [string, string]> = { serving: ['በአገልግሎት ላይ', 'present'], not_serving: ['አያገለግሉም', 'absent'], away: ['ርቀው ያሉ', 'half'] };

type Student = { member_id: string; decided_at: string | null; members: { full_name: string; reg_no: string; phone: string | null; sex: string; dob: string | null; geez_level: string; sub_city: string | null } };
type Clergy = {
  id: string; member_id: string | null; full_name: string; rank: string; ordained_on: string | null; bishop: string | null;
  place: string | null; service_status: string; file_path: string | null; file_name: string | null; note: string | null;
};

/** ትምህርት ክፍል → አብነት: lessons, ዲያቆናት (members who chose አብነት), ⛪ ካህናት register. ክትትል is on the attendance page. */
export default async function EducationAbnet({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ v?: string; q?: string; m?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const view = sp.v === 'students' || sp.v === 'clergy' ? sp.v : 'list';
  const bar = (title: string, extra?: React.ReactNode) => (
    <div className="page-bar">
      <h2 className="section" style={{ margin: 0 }}>{title}</h2>
      <AbnetTabs current={view} />
      <span className="spacer" />
      {extra}
    </div>
  );

  if (view === 'list') {
    const { data } = await supabase.from('abnet_sessions').select(ABNET_COLS_LINK).order('created_at');
    const rows = ((data ?? []) as Abnet[]).map((a) => ({ ...a, audio_url: mediaUrl(supabase, a.audio_path), file_url: mediaUrl(supabase, a.file_path) }));
    return (
      <>
        {bar('አብነት', (
          <Modal label="+ ትምህርት ጨምር" title="አዲስ የአብነት ትምህርት" size="lg">
            <MediaForm action={saveAbnet} submitLabel="+ ጨምር" fileField={['audio', 'file']} folder="abnet" card={false}><AbnetFields /></MediaForm>
          </Modal>
        ))}
        <AbnetTable rows={rows} editable />
      </>
    );
  }

  const [{ data: st }, { data: cl }] = await Promise.all([
    supabase.from('member_programs').select('member_id, decided_at, members!inner(full_name, reg_no, phone, is_active, sex, dob, geez_level, sub_city)')
      .eq('program', 'abnet').eq('status', 'active').eq('members.is_active', true).returns<Student[]>(),
    supabase.from('clergy').select('id, member_id, full_name, rank, ordained_on, bishop, place, service_status, file_path, file_name, note').order('full_name'),
  ]);
  const students = (st ?? []).sort((a, b) => a.members.full_name.localeCompare(b.members.full_name, 'am'));
  const clergy = (cl ?? []) as Clergy[];
  const inRegister = new Map(clergy.filter((c) => c.member_id).map((c) => [c.member_id!, c]));
  const q = sp.q?.trim();
  const hit = (name: string, reg = '') => !q || name.includes(q) || reg.includes(q.toUpperCase());

  if (view === 'students') {
    const ids = students.map((s) => s.member_id);
    const { data: att } = ids.length
      ? await supabase.from('attendance').select('member_id, status, attendance_sessions!inner(session_type, session_date, title)')
          .eq('attendance_sessions.session_type', 'abnet').in('member_id', ids)
      : { data: [] };
    type A = { member_id: string; status: string; attendance_sessions: { session_date: string; title: string | null } };
    const atts = (att ?? []) as unknown as A[];
    const pctOf = (id: string) => {
      const mine = atts.filter((a) => a.member_id === id);
      return mine.length ? { n: mine.length, pct: Math.round((mine.reduce((t, a) => t + (a.status === 'present' ? 1 : a.status === 'half' ? 0.5 : 0), 0) / mine.length) * 100) } : null;
    };
    const one = students.find((s) => s.member_id === sp.m);
    const searchBar = (
      <>
        <form className="toolbar slim no-print" action="/staff/education/abnet">
          <input type="hidden" name="v" value="students" />
          <input name="q" type="search" defaultValue={q} placeholder="🔍 ስም / ቁጥር" aria-label="ፈልግ" style={{ width: 170 }} />
        </form>
        <PrintButton />
      </>
    );
    if (one) {
      const p = pctOf(one.member_id);
      const c = inRegister.get(one.member_id);
      const hist = atts.filter((a) => a.member_id === one.member_id)
        .sort((a, b) => b.attendance_sessions.session_date.localeCompare(a.attendance_sessions.session_date));
      const ST: Record<string, [string, string]> = { present: ['ተገኝቷል', 'present'], half: ['ግማሽ', 'half'], absent: ['ቀሪ', 'absent'] };
      return (
        <>
          {bar('አብነት', searchBar)}
          <section className="card">
            <div className="card-head">
              <b>{one.members.full_name}</b><span className="small muted">{one.members.reg_no}</span>
              {c && <span className="pill present">⛪ {RANK[c.rank]}</span>}
              <span className="spacer" />
              <Link className="btn sm secondary no-print" href="/staff/education/abnet?v=students">← ወደ ተማሪዎች</Link>
            </div>
            <div className="stat-row">
              <span><b>{SEX[one.members.sex as keyof typeof SEX] ?? '—'}</b> ጾታ</span>
              <span><b>{ageFromIso(one.members.dob) ?? '—'}</b> ዕድሜ</span>
              <span><b>{GEEZ_LEVEL[one.members.geez_level as keyof typeof GEEZ_LEVEL] ?? '—'}</b> የግዕዝ ደረጃ</span>
              <span><b>{p ? `${p.pct}%` : '—'}</b> ክትትል {p ? `(${p.n})` : ''}</span>
              <span><b dir="ltr">{one.members.phone ?? '—'}</b> ስልክ</span>
              <span><b>{one.members.sub_city ?? '—'}</b> ክፍለ ከተማ</span>
              <span><b>{one.decided_at ? formatEc(one.decided_at.slice(0, 10)) : '—'}</b> አብነት የጀመሩበት</span>
            </div>
            {!c && (
              <div className="no-print" style={{ marginBottom: 12 }}>
                <Modal label="⛪ ወደ ካህናት መዝገብ" title="ወደ ካህናት መዝገብ" sub={one.members.full_name} btnClass="btn sm secondary" size="lg">
                  <ClergyForm init={{ member_id: one.member_id, full_name: one.members.full_name }} />
                </Modal>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr><th>ቀን</th><th>ክፍለ ጊዜ</th><th>ሁኔታ</th></tr></thead>
                <tbody>
                  {hist.map((h, i) => (
                    <tr key={i}>
                      <td>{formatEc(h.attendance_sessions.session_date, { weekday: true })}</td>
                      <td>{h.attendance_sessions.title ?? 'አብነት ትምህርት'}</td>
                      <td><span className={`pill ${ST[h.status]?.[1] ?? ''}`}>{ST[h.status]?.[0] ?? h.status}</span></td>
                    </tr>
                  ))}
                  {hist.length === 0 && <tr><td colSpan={3} className="muted">እስካሁን ክትትል አልተያዘም።</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      );
    }
    const shown = students.filter((s) => hit(s.members.full_name, s.members.reg_no));
    return (
      <>
        {bar('አብነት', searchBar)}
        <div className="card-head"><b>ተማሪዎች — ዲያቆናት</b><span className="count-badge">{shown.length}</span></div>
        <p className="small muted">በምዝገባ ጊዜ “አብነት”ን የመረጡ አባላት። ዝርዝሩን ለማየት ስሙን ይጫኑ። ክትትላቸው በ“ክትትል መያዝ” ይያዛል።</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>ተማሪ</th><th>ጾታ</th><th className="num">ዕድሜ</th><th>የግዕዝ ደረጃ</th><th>ስልክ</th><th className="num">ክትትል</th><th>ካህናት መዝገብ</th></tr></thead>
            <tbody>
              {shown.map((s, i) => {
                const p = pctOf(s.member_id);
                const c = inRegister.get(s.member_id);
                return (
                  <tr key={s.member_id}>
                    <td className="num">{i + 1}</td>
                    <td><Link className="link" href={`/staff/education/abnet?v=students&m=${s.member_id}`}><b>{s.members.full_name}</b></Link> <span className="small muted">{s.members.reg_no}</span></td>
                    <td className="small">{SEX[s.members.sex as keyof typeof SEX] ?? '—'}</td>
                    <td className="num">{ageFromIso(s.members.dob) ?? '—'}</td>
                    <td className="small">{GEEZ_LEVEL[s.members.geez_level as keyof typeof GEEZ_LEVEL] ?? '—'}</td>
                    <td dir="ltr" className="small">{s.members.phone ?? '—'}</td>
                    <td className="num">{p === null ? '—' : <span className={`pill ${p.pct >= 75 ? 'present' : p.pct >= 50 ? 'half' : 'absent'}`}>{p.pct}%</span>}</td>
                    <td className="no-print">
                      {c ? <span className="pill present">⛪ {RANK[c.rank]}</span> : (
                        <Modal label="⛪ ወደ ካህናት" title="ወደ ካህናት መዝገብ" sub={s.members.full_name} btnClass="btn xs secondary" size="lg">
                          <ClergyForm init={{ member_id: s.member_id, full_name: s.members.full_name }} />
                        </Modal>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={8} className="muted">“አብነት”ን የመረጠ አባል የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ⛪ ካህናት
  const files = clergy.map((c) => c.file_path).filter((p): p is string => !!p);
  const { data: signed } = files.length ? await supabase.storage.from('edu-books').createSignedUrls(files, 3600) : { data: [] };
  const urlOf = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  const shown = clergy.filter((c) => hit(c.full_name));
  const count = (s: string) => clergy.filter((c) => c.service_status === s).length;
  return (
    <>
      {bar('አብነት', (
        <>
          <PrintButton />
          <Modal label="+ መዝግብ" title="ካህናትና ዲያቆናት — አዲስ" size="lg"><ClergyForm members={students} /></Modal>
        </>
      ))}
      <div className="card-head">
        <b>⛪ የካህናትና የዲያቆናት መዝገብ</b><span className="count-badge">{clergy.length}</span>
        <span className="spacer" />
        {Object.entries(SERVICE).map(([k, [l, cls]]) => <span key={k} className={`pill ${cls}`}>{l} {count(k)}</span>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ስም</th><th>ማዕረግ</th><th>የተሾሙበት ቀን</th><th>የሾሟቸው ጳጳስ</th><th>ቦታ</th><th>አገልግሎት</th><th>ፋይል</th><th className="no-print" /></tr></thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td><b>{c.full_name}</b>{c.note && <div className="small muted">{c.note}</div>}</td>
                <td>{RANK[c.rank]}</td>
                <td className="small">{c.ordained_on ? formatEc(c.ordained_on) : '—'}</td>
                <td className="small">{c.bishop ?? '—'}</td>
                <td className="small">{c.place ?? '—'}</td>
                <td><span className={`pill ${SERVICE[c.service_status]?.[1] ?? ''}`}>{SERVICE[c.service_status]?.[0] ?? c.service_status}</span></td>
                <td className="small">{c.file_path && urlOf.get(c.file_path) ? <a className="link" href={urlOf.get(c.file_path)!} target="_blank" rel="noreferrer">📎 {c.file_name ?? 'ፋይል'}</a> : '—'}</td>
                <td className="no-print">
                  <div className="btn-row">
                    <Modal label="✎" title="አስተካክል" sub={c.full_name} btnClass="btn xs secondary" size="lg"><ClergyForm init={c} /></Modal>
                    <ActionButton action={deleteClergy.bind(null, c.id)} label="×" className="btn xs danger" confirmText={`${c.full_name} ከመዝገቡ ይወገዱ?`} />
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} className="muted">እስካሁን የተመዘገበ የለም — “+ መዝግብ” ወይም በ“ዲያቆናት” ዝርዝር “⛪ ወደ ካህናት” ይጫኑ።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Add / edit one ካህናት record. With `members`, a member can be picked (or a name typed for someone not registered). */
function ClergyForm({ init, members }: { init?: Partial<Clergy>; members?: Student[] }) {
  const fixed = !!init?.member_id || !!init?.id;
  return (
    <MediaForm action={saveClergy} submitLabel={init?.id ? 'አስቀምጥ' : '+ መዝግብ'} card={false} fileField="file" folder="clergy" bucket="edu-books">
      {init?.id && <input type="hidden" name="id" value={init.id} />}
      {init?.member_id && <input type="hidden" name="member_id" value={init.member_id} />}
      <div className="form-grid">
        {!fixed && members && (
          <div className="field">
            <label htmlFor="cg-m">ከዲያቆናት ዝርዝር</label>
            <select id="cg-m" name="member_id" defaultValue="">
              <option value="">— ያልተመዘገበ ሰው (ስሙን ይጻፉ) —</option>
              {members.map((m) => <option key={m.member_id} value={m.member_id}>{m.members.full_name} · {m.members.reg_no}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="cg-n">ሙሉ ስም {fixed ? '' : <span className="small muted">(አባል ከተመረጠ አያስፈልግም)</span>}</label>
          <input id="cg-n" name="full_name" defaultValue={init?.full_name ?? ''} maxLength={120} readOnly={!!init?.member_id && !init?.id} />
        </div>
        <div className="field">
          <label htmlFor="cg-r">ማዕረግ</label>
          <select id="cg-r" name="rank" defaultValue={init?.rank ?? 'deacon'}>{Object.entries(RANK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="field">
          <span className="label">ሥልጣነ ክህነት የተቀበሉበት ቀን</span>
          <EcDatePicker name="ordained_on" defaultIso={init?.ordained_on ?? null} yearsBack={60} yearsForward={0} />
        </div>
        <div className="field"><label htmlFor="cg-b">የሾሟቸው ብፁዕ አቡነ …</label><input id="cg-b" name="bishop" defaultValue={init?.bishop ?? ''} maxLength={120} placeholder="የጳጳሱ ስም" /></div>
        <div className="field"><label htmlFor="cg-p">ቦታ</label><input id="cg-p" name="place" defaultValue={init?.place ?? ''} maxLength={160} placeholder="ለምሳሌ፦ መንበረ ፓትርያርክ" /></div>
        <div className="field">
          <label htmlFor="cg-s">የአገልግሎት ሁኔታ</label>
          <select id="cg-s" name="service_status" defaultValue={init?.service_status ?? 'serving'}>{Object.entries(SERVICE).map(([k, [v]]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="cg-f">ፋይል (የምስክር ወረቀት፣ PDF / ምስል) {init?.file_name && <span className="small muted">· አሁን፦ {init.file_name}</span>}</label>
          <input id="cg-f" name="file" type="file" accept=".pdf,image/*" />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="cg-x">ማስታወሻ</label><input id="cg-x" name="note" defaultValue={init?.note ?? ''} maxLength={500} /></div>
      </div>
    </MediaForm>
  );
}
