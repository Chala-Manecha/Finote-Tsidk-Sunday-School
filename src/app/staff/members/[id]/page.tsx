import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ageFromIso, formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import {
  DEPT_NAME, GEEZ_LEVEL, MARITAL_STATUS, MEMBER_STATUS, memberTypeLabel, SEX, TITLES, WORK_STATUS,
} from '@/lib/constants';
import { PART_AREAS, type PartArea } from '@/lib/participation';
import { PrintButton } from '@/components/print-button';
import { ActionButton } from '@/components/action-button';
import { canAccess } from '@/lib/auth';
import { deactivateMember, restoreMember, deleteMember } from '@/app/staff/members/actions';
import { RegistrationSlip, type SlipData } from '@/components/registration-slip';
import { yearsLabel, type EducationEntry, type WorkEntry } from '@/lib/member-details';

type Absence = { on_date: string; area: PartArea; label: string; status: 'absent' | 'half' };

export default async function MemberDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const staff = await requireDept('hr', 'office');
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const [{ data: m }, { data: att }, { data: ageGroups }, { data: history }] = await Promise.all([
    supabase.from('members').select('*, member_departments(dept)').eq('id', id).maybeSingle(),
    supabase.rpc('member_absences', { p_member: id, p_limit: 300 }),
    supabase.from('age_groups').select('code, name'),
    supabase.rpc('member_history_count', { p_member: id }),
  ]);
  const isHr = canAccess(staff, 'hr');
  if (!m) notFound();

  // Absences per area (department sheets, course classes, teaching) — newest first, folded by area.
  const absences = (att ?? []) as Absence[];
  const byArea = (Object.keys(PART_AREAS) as PartArea[])
    .map((a) => ({ area: a, rows: absences.filter((x) => x.area === a) }))
    .filter((g) => g.rows.length);

  const signed = async (path?: string | null) =>
    path ? (await supabase.storage.from('member-docs').createSignedUrl(path, 600)).data?.signedUrl : null;
  const priorUrl = await signed(m.prior_school?.evidence_path);
  const photoUrl = await signed(m.photo_path);
  const secularUrl = await signed(m.secular_school?.evidence_path);
  const eduUrls = await Promise.all(((m.education ?? []) as EducationEntry[]).map((e) => signed(e.evidence_path)));

  const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));
  const education = (m.education ?? []) as EducationEntry[];
  const work = (m.work ?? []) as WorkEntry[];
  const ec = isoToEc(todayIsoAddis()).year;
  const fullName = [m.first_name, m.father_name, m.grandfather_name].filter(Boolean).join(' ') || m.full_name;
  // The member detail IS the membership certificate (same layout as printed); HR edits it with “አርም”.
  const slip: SlipData = {
    fullName: `${m.title ? `${TITLES[m.title as keyof typeof TITLES]} ` : ''}${fullName}`,
    photo: photoUrl ?? null,
    sections: [
      { title: 'የአባልነት መረጃ', rows: [
        ['የአባልነት ሁኔታ', memberTypeLabel(m.member_type, m.member_type_other)],
        ['አገልግሎት የጀመሩበት ዓመት', m.joined_year ? `${m.joined_year} ዓ.ም (የአገልግሎት ቆይታ ${Math.max(ec - m.joined_year, 0)} ዓመት)` : ''],
        ['የዕድሜ ክፍል', (ageGroups ?? []).find((g) => g.code === m.age_group)?.name ?? ''],
        ['ሁኔታ', MEMBER_STATUS[m.member_status as keyof typeof MEMBER_STATUS] ?? ''],
      ] },
      { title: 'የግል መረጃ ዝርዝር', rows: [
        ['የእናት ስም', dash(m.mother_name)],
        ['የክርስትና ስም', dash(m.christian_name)],
        ['ክርስትና የተነሱበት', dash(m.baptism_church)],
        ['የትውልድ ቀን', m.dob ? `${formatEc(m.dob)} (ዕድሜ ${ageFromIso(m.dob)})` : ''],
        ['ፆታ', SEX[m.sex as keyof typeof SEX] ?? ''],
        ['የትዳር ሁኔታ', m.marital_status ? MARITAL_STATUS[m.marital_status as keyof typeof MARITAL_STATUS] : ''],
        ['ዜግነት', m.is_ethiopian ? 'ኢትዮጵያዊ' : dash(m.nationality)],
        ['ቋንቋ', (m.languages ?? []).join('፣ ')],
        ['የግዕዝ ችሎታ', GEEZ_LEVEL[m.geez_level as keyof typeof GEEZ_LEVEL] ?? ''],
      ] },
      { title: 'አድራሻ', rows: [
        ['አድራሻ', [m.region, m.city, m.sub_city, m.woreda && `ወረዳ ${m.woreda}`, m.house_no && `የቤት ቁ. ${m.house_no}`].filter(Boolean).join('፣ ')],
        ['ስልክ', [m.phone, m.phone2].filter(Boolean).join(' · ')],
        ['ኢሜይል', dash(m.email)],
        ['Telegram', m.telegram_username ? `@${m.telegram_username}` : ''],
      ] },
      { title: 'ንሰሐ አባት እና የአደጋ ጊዜ ተጠሪ', rows: [
        ['የንሰሐ አባት', [m.confessor_name, m.confessor_phone].filter(Boolean).join(' · ')],
        ['የአደጋ ጊዜ ተጠሪ', [m.emergency_name, m.emergency_relation && `(${m.emergency_relation})`, m.emergency_phone].filter(Boolean).join(' ')],
      ] },
      { title: 'ትምህርት', rows: [
        ...education.map((e, i): [string, string] => [`ትምህርት ${i + 1}`, `${[e.level, e.field, e.institution].filter(Boolean).join(' · ')} ${yearsLabel(e)}`]),
        ['ቀድሞ ሰ/ት/ቤት', m.prior_school ? `${m.prior_school.name} · ${m.prior_school.years ?? '—'} ዓመት` : ''],
      ] },
      { title: 'ሥራ', rows: [
        ['ሁኔታ', WORK_STATUS[m.work_status as keyof typeof WORK_STATUS] ?? ''],
        ...work.map((w, i): [string, string] => [`ሥራ ${i + 1}`, `${[w.field, w.workplace].filter(Boolean).join(' · ')} ${yearsLabel(w)}`]),
      ] },
      { title: 'ዝንባሌ', rows: [['ማገልገል የሚፈልጉበት ክፍል', m.member_departments.map((d: { dept: string }) => DEPT_NAME[d.dept]).join('፣ ')]] },
    ],
  };
  const evidence = [
    ...education.map((e, i) => [`ትምህርት ${i + 1}${e.level ? ` (${e.level})` : ''}`, eduUrls[i]] as const),
    ['አለማዊ ትምህርት', secularUrl] as const,
    ['ቀድሞ ሰ/ት/ቤት', priorUrl] as const,
    ['ፎቶ', photoUrl] as const,
  ].filter(([, u]) => !!u) as [string, string][];

  return (
    <>
      <div className="crumb no-print">
        <Link href="/staff">ሁሉም ክፍሎች</Link> › <Link href="/staff/hr/members">አባላት</Link> › {m.full_name}
      </div>
      {saved && <div className="alert ok no-print">ተቀምጧል።</div>}
      <div className="cert-toolbar no-print">
        <div>
          <b>{m.full_name}</b>
          {!m.is_active && <span className="pill absent" style={{ marginInlineStart: 8 }}>ተሰርዟል</span>}
          <div className="small muted">የአባልነት ማረጋገጫ ምስክር ወረቀት — የሚታየው እንደሚታተመው ነው።</div>
        </div>
        <div className="btn-row">
          <Link className="btn sm" href={`/staff/members/${id}/edit`}>✏ መረጃውን አርም</Link>
          <PrintButton />
          {m.is_active
            ? <ActionButton action={deactivateMember.bind(null, id)} label="ሰርዝ (አቦዝን)" className="btn sm secondary"
                confirmText={`${m.full_name} ከንቁ አባላት ዝርዝር ይውጣ? ታሪኩ ይቀመጣል፤ በኋላ መመለስ ይቻላል።`} />
            : <ActionButton action={restoreMember.bind(null, id)} label="መልስ (አንቃ)" className="btn sm green" />}
          {isHr && history === 0 && (
            <ActionButton action={deleteMember.bind(null, id)} label="ሙሉ በሙሉ አጥፋ" className="btn sm danger"
              confirmText={`${m.full_name} ሙሉ በሙሉ ይጥፋ? ይህ አይመለስም።`} />
          )}
        </div>
      </div>

      <nav className="sec-nav no-print" aria-label="ክፍሎች">
        <a href="#cert">📜 ምስክር ወረቀት</a>
        <a href="#docs">📎 የተያያዙ ሰነዶች <span className="chip-n">{evidence.length}</span></a>
        {absences.length > 0 && <a href="#absent">🗓 የቀሩባቸው ቀናት <span className="chip-n">{absences.length}</span></a>}
      </nav>

      <section id="cert" className="detail-sec">
        <RegistrationSlip slip={slip} regNo={m.reg_no} qrUrl={`/verify?c=${encodeURIComponent(m.reg_no)}`} registeredIso={m.registered_on ?? m.created_at} />
      </section>

      <section id="docs" className="detail-sec card no-print">
        <h2 className="section" style={{ marginTop: 0 }}>የተያያዙ ሰነዶች</h2>
        {evidence.length === 0
          ? <p className="muted small" style={{ margin: 0 }}>ምንም የተያያዘ ሰነድ የለም።</p>
          : (
            <div className="doc-tiles">
              {evidence.map(([k, u]) => (
                <a key={k} className="doc-tile" href={u} target="_blank" rel="noopener noreferrer">
                  <span aria-hidden>📎</span><b>{k}</b><span className="small muted">ክፈት ↗</span>
                </a>
              ))}
            </div>
          )}
      </section>

      {/* Absences: for follow-up on screen only — never on the printout, and only when there are any. */}
      {absences.length > 0 && (
        <section id="absent" className="detail-sec card no-print">
          <h2 className="section" style={{ marginTop: 0 }}>የቀሩባቸው ቀናት</h2>
          <p className="small muted" style={{ marginTop: -4 }}>በዘርፍ ተከፋፍሏል — ዘርፉን ሲጫኑ ቀኖቹ ይታያሉ። ሙሉ ሪፖርቱ በ“አጠቃላይ አቴንዳንስ” ይገኛል።</p>
          <div className="abs-list">
            {byArea.map((g) => {
              const full = g.rows.filter((r) => r.status === 'absent').length;
              return (
                <details key={g.area} className="abs-row">
                  <summary>
                    <span><b>{PART_AREAS[g.area]}</b></span>
                    <span className="num"><span className={`abs-count ${full >= 3 ? 'hi' : ''}`}>{full}</span></span>
                    <span className="num small">{g.rows.length - full ? `${g.rows.length - full} ${g.area === 'teaching' ? 'አርፍዷል' : 'ግማሽ'}` : '—'}</span>
                  </summary>
                  <table>
                    <thead><tr><th>ቀን</th><th>ዝርዝር</th><th>ሁኔታ</th></tr></thead>
                    <tbody>
                      {g.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{formatEc(r.on_date, { weekday: true })}</td>
                          <td>{r.label || PART_AREAS[g.area]}</td>
                          <td><span className="pill absent">{r.status === 'half' ? (g.area === 'teaching' ? 'አርፍዷል' : 'ግማሽ') : 'ቀሪ'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
