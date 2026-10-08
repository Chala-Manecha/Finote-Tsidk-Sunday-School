import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDept, canAccess } from '@/lib/auth';
import { DEPT_NAME, TITLES, LEADER_ROLE, LEAVE_REASON, STUDY_MODE, formatBirr, memberTypeLabel, type LeaderRole, type LeaveReason, type StudyMode } from '@/lib/constants';
import { classLabel } from '@/lib/education';
import { formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { termLabel, type Term } from '@/lib/periods';
import { DocHeader, DocSigns, QrCode, verifyUrl } from '@/components/doc-sheet';
import { DocPrintButton } from '@/components/doc-print-button';
import { markCertificatePrinted } from '@/lib/actions/receipts';

type RoleRow = { dept: string; role: LeaderRole; leadership_terms: Term | null };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireDept('hr', 'office', 'audit');
  const supabase = await createClient();
  const { data: d } = await supabase.from('member_departures')
    .select('id, member_id, leave_date, reason_text, reason_category, status, commendation, cert_no, print_count, decided_at, reinstated_at')
    .eq('id', id).maybeSingle();
  if (!d || d.status !== 'approved' || !d.cert_no) notFound();

  const [{ data: m }, { data: depts }, { data: roles }, { data: enr }] = await Promise.all([
    supabase.from('members').select('full_name, reg_no, title, sex, joined_year, created_at, photo_path, christian_name, member_type, member_type_other, age_group, age_groups(name)').eq('id', d.member_id).single(),
    supabase.from('member_departments').select('dept').eq('member_id', d.member_id),
    supabase.from('leadership_roles').select('dept, role, leadership_terms(*)').eq('member_id', d.member_id),
    supabase.from('enrollments').select('class_level, study_mode, academic_years(ec_year)').eq('member_id', d.member_id),
  ]);
  if (!m) notFound();
  const photo = m.photo_path
    ? (await supabase.storage.from('member-docs').createSignedUrl(m.photo_path, 600)).data?.signedUrl
    : null;

  // The department's results while this member served (same formula as the ኦዲት ranking).
  const roleRows = ((roles ?? []) as unknown as RoleRow[]).filter((r) => r.leadership_terms);
  const results = await Promise.all(roleRows.map(async (r) => {
    const t = r.leadership_terms!;
    const to = t.ends_on && t.ends_on < todayIsoAddis() ? t.ends_on : todayIsoAddis();
    const { data } = await supabase.rpc('dept_contributions', { p_from: t.starts_on ?? '2000-01-01', p_to: to });
    const row = (data ?? []).find((x: { dept: string }) => x.dept === r.dept) as { net: number; rank: number } | undefined;
    return { ...r, t, from: t.starts_on, to, net: row?.net ?? 0, rank: row?.rank ?? null, of: (data ?? []).length };
  }));

  const fromYear = m.joined_year ?? isoToEc(m.created_at).year;
  const toYear = isoToEc(d.leave_date).year;
  const sundayYears = Math.max(toYear - fromYear, 0);
  type Enr = { class_level: string | null; study_mode: StudyMode; academic_years: { ec_year: number } | null };
  const lastEnr = ((enr ?? []) as unknown as Enr[]).sort((a, b) => (b.academic_years?.ec_year ?? 0) - (a.academic_years?.ec_year ?? 0))[0];
  const ageGroup = (m.age_groups as unknown as { name: string } | null)?.name;
  const facts: [string, string][] = [
    ['የክርስትና ስም', m.christian_name || '—'],
    ['የአባልነት ሁኔታ', memberTypeLabel(m.member_type, m.member_type_other)],
    ['ክፍል', ageGroup ?? '—'],
    ['የሰንበት እድሜ', `${sundayYears} ዓመት`],
    ['የትምህርት ክፍል', lastEnr ? `${lastEnr.class_level ? classLabel(lastEnr.class_level) : '—'} · ${STUDY_MODE[lastEnr.study_mode]}${lastEnr.academic_years ? ` (${lastEnr.academic_years.ec_year} ዓ.ም)` : ''}` : '—'],
  ];
  const mark = d.reinstated_at ? 'ተመልሰው ገብተዋል' : d.print_count > 0 ? 'ቅጂ (COPY)' : null;

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href="/staff/hr/departures">← ተመለስ</Link>
        {canAccess(staff, 'hr') && <DocPrintButton action={markCertificatePrinted.bind(null, d.id)} />}
      </div>
      <article className="doc-sheet">
        <DocHeader title="የመልቀቂያ የምስክር ወረቀት" code={d.cert_no} mark={mark} />
        <div className="cert-body">
          <div className="cert-text">
            <p>
              {m.title ? `${TITLES[m.title as keyof typeof TITLES]} ` : ''}<b>{m.full_name}</b> (መለያ ቁ. {m.reg_no}) ከ<b>{fromYear} ዓ.ም</b> እስከ{' '}
              <b>{formatEc(d.leave_date)}</b> ድረስ የፍኖተ ጽድቅ ሰንበት ትምህርት ቤት አባል ሆነው አገልግለዋል።
            </p>
            <dl className="doc-rows" style={{ margin: '10px 0 14px' }}>
              {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {(depts ?? []).length > 0 && (
              <p>በንዑስ አባልነት ያገለገሉባቸው ክፍሎች፦ <b>{(depts ?? []).map((x) => DEPT_NAME[x.dept]).join('፣ ')}</b>።</p>
            )}
            <p>
              የለቀቁበት ምክንያት (በራሳቸው አገላለጽ)፦ “{d.reason_text}” <span className="muted small">({LEAVE_REASON[d.reason_category as LeaveReason]})</span>
            </p>
          </div>
          {photo ? <img className="cert-photo" src={photo} alt="" /> : <div className="cert-photo" />}
        </div>

        {results.length > 0 && (
          <>
            <h3 className="serif" style={{ marginBottom: 6 }}>የአመራርነት አገልግሎት</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ሚና</th><th>የአመራር ቡድን</th><th>ዘመን</th><th className="num">የክፍሉ የተጣራ አስተዋጽኦ</th><th className="num">ደረጃ</th></tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={`${r.t.id}-${r.dept}-${r.role}`}>
                      <td>የ{DEPT_NAME[r.dept]} {LEADER_ROLE[r.role]}</td>
                      <td>{termLabel(r.t)}</td>
                      <td>{r.from ? formatEc(r.from) : '—'} – {formatEc(r.to)}</td>
                      <td className="num">{formatBirr(r.net)}</td>
                      <td className="num">{r.rank ? `${r.rank} / ${r.of}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">አስተዋጽኦው በአመራርነታቸው ዘመን የክፍሉ የጋራ ውጤት ነው (ገቢ + ከራስ ወጪ − የተጣራ ወጪ)።</p>
          </>
        )}
        {d.commendation && <p className="cert-text"><b>የጽሕፈት ቤት ምስጋና፦</b> {d.commendation}</p>}
        <p className="cert-text">ይህ የምስክር ወረቀት በጠየቁት መሰረት ተሰጥቷቸዋል። እግዚአብሔር አምላክ በሄዱበት ሁሉ ይጠብቃቸው።</p>

        <div className="doc-foot">
          <DocSigns roles={['ያዘጋጀው (የሰው ሃብት አስተዳደር)', 'ያጸደቀው (ጽሕፈት ቤት)']} />
          <div className="doc-stamp">ማኅተም</div>
          <div style={{ textAlign: 'center' }}>
            <QrCode text={await verifyUrl(d.cert_no)} />
            <div className="small muted" style={{ marginTop: 4 }}>ትክክለኛነቱን ያረጋግጡ</div>
          </div>
        </div>
      </article>
    </>
  );
}
