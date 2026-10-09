'use client';
import { useActionState, useState, startTransition, useRef } from 'react';
import { saveMember, type MemberFormState } from '@/app/staff/members/actions';
import { submitApplication, applicationUploadUrl } from '@/lib/actions/applications';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/client/upload';
import { EcDatePicker } from './ec-date-picker';
import { MultiSelect } from './multi-select';
import { RegistrationSlip, type SlipData } from './registration-slip';
import { ageFromIso, formatEc, isoToEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import {
  DEPARTMENTS, EDUCATION_LEVELS, EMERGENCY_RELATIONS, GEEZ_LEVEL, LANGUAGES, MARITAL_STATUS, MEMBER_TYPE,
  REGIONS, SEX, SUB_CITIES, TITLES, WORK_SECTORS, WORK_STATUS,
} from '@/lib/constants';
import { emptyEducation, emptyWork, type EducationEntry, type WorkEntry } from '@/lib/member-details';

export type MemberInitial = {
  id?: string;
  full_name?: string;
  sex?: string;
  title?: string | null;
  work_status?: string;
  dob?: string | null;
  phone?: string | null;
  email?: string | null;
  telegram_username?: string | null;
  sub_city?: string | null;
  languages?: string[] | null;
  photo_path?: string | null;
  photo_url?: string | null;
  reg_no?: string | null;
  joined_year?: number | null;
  geez_level?: string;
  is_ethiopian?: boolean;
  nationality?: string | null;
  prior_school?: { name?: string | null; years?: number | null; evidence_path?: string | null } | null;
  secular_school?: { name?: string | null; evidence_path?: string | null } | null;
  depts?: string[];
  registered_on?: string | null;
  member_type?: string | null;
  member_type_other?: string | null;
  first_name?: string | null;
  father_name?: string | null;
  grandfather_name?: string | null;
  mother_name?: string | null;
  christian_name?: string | null;
  baptism_church?: string | null;
  marital_status?: string | null;
  region?: string | null;
  city?: string | null;
  woreda?: string | null;
  house_no?: string | null;
  phone2?: string | null;
  confessor_name?: string | null;
  confessor_phone?: string | null;
  emergency_name?: string | null;
  emergency_relation?: string | null;
  emergency_phone?: string | null;
  education?: EducationEntry[] | null;
  work?: WorkEntry[] | null;
};

/** staff = HR registers/edits · public = self-registration (goes to HR) · approve = HR reviews an application */
export type FormMode = 'staff' | 'public' | 'approve';

const SECTIONS = [
  ['sec-membership', 'የአባልነት መረጃ'],
  ['sec-personal', 'የግል መረጃ ዝርዝር'],
  ['sec-address', 'አድራሻ'],
  ['sec-contacts', 'ንሰሐ አባት እና ተጠሪ'],
  ['sec-education', 'ትምህርት'],
  ['sec-work', 'ሥራ'],
  ['sec-depts', 'ዝንባሌ'],
] as const;

const LANG_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }));
const DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d.code, label: d.name }));
const MAX_FILE = 10 * 1024 * 1024;

/** Splits an old single full_name into ስም / የአባት ስም / የአያት ስም. */
function nameParts(i: MemberInitial): [string, string, string] {
  if (i.first_name || i.father_name) return [i.first_name ?? '', i.father_name ?? '', i.grandfather_name ?? ''];
  const w = (i.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  return [w[0] ?? '', w[1] ?? '', w.slice(2).join(' ')];
}

/** Staff upload straight to the private bucket (RLS); the public form gets a one-time signed URL from the server. */
async function upload(mode: FormMode, file: File | Blob, name = 'file'): Promise<string> {
  if (file.size > MAX_FILE) throw new Error('ፋይሉ ከ10MB በላይ ነው።');
  const supabase = createClient();
  if (mode === 'public') {
    const signed = await applicationUploadUrl(name);
    if ('error' in signed) throw new Error(signed.error);
    const { error } = await supabase.storage.from('member-docs').uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || undefined,
    });
    if (error) throw new Error(`ፋይል መጫን አልተቻለም፦ ${error.message}`);
    return signed.path;
  }
  const safe = name.replace(/[^\w.\-]+/g, '_').slice(-60);
  const path = `members/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('member-docs').upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`ፋይል መጫን አልተቻለም፦ ${error.message}`);
  return path;
}

const label = (map: Record<string, string>, v: FormDataEntryValue | null) => (v ? map[String(v)] ?? String(v) : '');
const yrs = (e: { start_year: number | null; end_year: number | null; current: boolean }, now: string) =>
  e.start_year || e.end_year || e.current ? `${e.start_year ?? '?'} – ${e.current ? now : (e.end_year ?? '?')}` : '';

/** Everything the applicant filled in, as label/value rows for the printable slip. */
function buildSlip(fd: FormData, education: EducationEntry[], work: WorkEntry[], photo: string | null): SlipData {
  const v = (k: string) => String(fd.get(k) ?? '').trim();
  const dob = v('dob');
  const fullName = [v('first_name'), v('father_name'), v('grandfather_name')].filter(Boolean).join(' ');
  const langs = [...fd.getAll('languages').map(String), v('language_other')].filter(Boolean).join('፣ ');
  const depts = fd.getAll('depts').map((d) => DEPARTMENTS.find((x) => x.code === d)?.name ?? String(d)).join('፣ ');
  return {
    fullName,
    photo,
    sections: [
      { title: 'የአባልነት መረጃ', rows: [
        ['የአባልነት ሁኔታ', v('member_type') === 'other' ? v('member_type_other') : label(MEMBER_TYPE, fd.get('member_type'))],
        ['አገልግሎት የጀመሩበት ዓመት', v('joined_year') ? `${v('joined_year')} ዓ.ም` : ''],
      ] },
      { title: 'የግል መረጃ ዝርዝር', rows: [
        ['ማዕረግ', label(TITLES, fd.get('title'))],
        ['ሙሉ ስም', fullName],
        ['የእናት ስም', v('mother_name')],
        ['የክርስትና ስም', v('christian_name')],
        ['ክርስትና የተነሱበት', v('baptism_church')],
        ['የትውልድ ቀን', dob ? `${formatEc(dob)} (ዕድሜ ${ageFromIso(dob)})` : ''],
        ['ፆታ', label(SEX, fd.get('sex'))],
        ['የትዳር ሁኔታ', label(MARITAL_STATUS, fd.get('marital_status'))],
        ['ዜግነት', fd.get('is_ethiopian') === 'on' ? 'ኢትዮጵያዊ' : v('nationality')],
        ['ቋንቋ', langs],
        ['የግዕዝ ችሎታ', label(GEEZ_LEVEL, fd.get('geez_level'))],
      ] },
      { title: 'አድራሻ', rows: [
        ['አድራሻ', [v('region'), v('city'), v('sub_city'), v('woreda') && `ወረዳ ${v('woreda')}`, v('house_no') && `የቤት ቁ. ${v('house_no')}`].filter(Boolean).join('፣ ')],
        ['ስልክ', [v('phone'), v('phone2')].filter(Boolean).join(' · ')],
        ['ኢሜይል', v('email')],
        ['Telegram', v('telegram_username')],
      ] },
      { title: 'ንሰሐ አባት እና የአደጋ ጊዜ ተጠሪ', rows: [
        ['የንሰሐ አባት', [v('confessor_name'), v('confessor_phone')].filter(Boolean).join(' · ')],
        ['የአደጋ ጊዜ ተጠሪ', [v('emergency_name'), v('emergency_relation') && `(${v('emergency_relation')})`, v('emergency_phone')].filter(Boolean).join(' ')],
      ] },
      { title: 'ትምህርት', rows: [
        ...education.filter((e) => e.level || e.field || e.institution)
          .map((e, i): [string, string] => [`ትምህርት ${i + 1}`, `${[e.level, e.field, e.institution].filter(Boolean).join(' · ')} ${yrs(e, 'አሁን')}`]),
        ['ቀድሞ ሰ/ት/ቤት', fd.get('has_prior_school') === 'on' ? `${v('prior_school_name')} · ${v('prior_school_years') || '—'} ዓመት` : ''],
      ] },
      { title: 'ሥራ', rows: [
        ['ሁኔታ', label(WORK_STATUS, fd.get('work_status'))],
        ...(v('work_status') === 'worker' ? work.filter((w) => w.field || w.workplace)
          .map((w, i): [string, string] => [`ሥራ ${i + 1}`, `${[w.field, w.workplace].filter(Boolean).join(' · ')} ${yrs(w, 'አሁን')}`]) : []),
      ] },
      { title: 'ዝንባሌ', rows: [['ማገልገል የሚፈልጉበት ክፍል', depts]] },
    ],
  };
}

function Section({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="form-block" id={id}>
      <legend><span className="step-no">{n}</span>{title}</legend>
      {children}
    </fieldset>
  );
}

/** "ከ — እስከ / እስከ አሁን" year inputs shared by education and work rows. */
function YearsFields({ e, set, nowLabel }: {
  e: { start_year: number | null; end_year: number | null; current: boolean };
  set: (patch: Partial<{ start_year: number | null; end_year: number | null; current: boolean }>) => void;
  nowLabel: string;
}) {
  const num = (v: string) => (v === '' ? null : Number(v));
  return (
    <>
      <div className="field"><label>የጀመሩበት ዓመት (ዓ.ም)</label>
        <input type="number" min={1900} max={2100} value={e.start_year ?? ''} onChange={(x) => set({ start_year: num(x.target.value) })} /></div>
      {!e.current && (
        <div className="field"><label>ያበቁበት ዓመት (ዓ.ም)</label>
          <input type="number" min={1900} max={2100} value={e.end_year ?? ''} onChange={(x) => set({ end_year: num(x.target.value) })} /></div>
      )}
      <label className="check" style={{ alignSelf: 'end' }}>
        <input type="checkbox" checked={e.current} onChange={(x) => set({ current: x.target.checked })} /> {nowLabel}
      </label>
    </>
  );
}

export function MemberForm({ initial = {}, mode = 'staff', applicationId }: {
  initial?: MemberInitial; mode?: FormMode; applicationId?: string;
}) {
  const [state, action, pending] = useActionState<MemberFormState, FormData>(mode === 'public' ? submitApplication : saveMember, {});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(initial.dob ?? null);
  const [joined, setJoined] = useState<string>(initial.joined_year ? String(initial.joined_year) : '');
  const [hasPrior, setHasPrior] = useState(!!initial.prior_school);
  const [isEthiopian, setIsEthiopian] = useState(initial.is_ethiopian ?? true);
  const [memberType, setMemberType] = useState(initial.member_type ?? 'regular');
  const [workStatus, setWorkStatus] = useState(initial.work_status ?? '');
  const [region, setRegion] = useState(initial.region ?? (initial.id ? (initial.sub_city ? 'አዲስ አበባ' : '') : 'አዲስ አበባ'));
  const initLangs = initial.languages ?? [];
  const otherLangs = initLangs.filter((l) => !(LANGUAGES as readonly string[]).includes(l));
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo_url ?? null);
  const [education, setEducation] = useState<EducationEntry[]>(() => {
    // Deterministic keys for the first render (server and browser must match).
    const rows = initial.education?.length ? initial.education.map((e, i) => ({ ...e, _k: `init${i}` })) : [{ ...emptyEducation(), _k: 'init0' }];
    // Older records kept one evidence file for all education; show it on the first row.
    const legacy = initial.secular_school?.evidence_path;
    if (legacy && !rows.some((e) => e.evidence_path)) rows[0] = { ...rows[0], evidence_path: legacy };
    return rows;
  });
  const [work, setWork] = useState<WorkEntry[]>(initial.work?.length ? initial.work : [emptyWork()]);
  const [slip, setSlip] = useState<SlipData | null>(null);
  const [pinShown, setPinShown] = useState('');
  const [first, father, grand] = nameParts(initial);
  const isNew = !initial.id;

  const age = ageFromIso(dob);
  const thisYear = isoToEc(todayIsoAddis()).year;
  const joinedNum = Number(joined);
  const sundayAge = joined && Number.isInteger(joinedNum) && joinedNum <= thisYear && joinedNum > 1900 ? thisYear - joinedNum : null;
  const patchEdu = (i: number, p: Partial<EducationEntry>) => setEducation(education.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const patchWork = (i: number, p: Partial<WorkEntry>) => setWork(work.map((e, j) => (j === i ? { ...e, ...p } : e)));

  // "Are you sure?" before a new registration is sent.
  const [confirming, setConfirming] = useState(false);
  const confirmed = useRef(false);
  const formEl = useRef<HTMLFormElement>(null);

  function precheck(fd: FormData): string | null {
    const photo = fd.get('photo_file');
    if (!(photo instanceof File && photo.size > 0) && !initial.photo_path) return 'የአባል ፎቶ ያስገቡ።';
    if (isNew && !String(fd.get('dob') ?? '')) return 'የትውልድ ቀን (ቀን፣ ወር እና ዓ.ም) ይምረጡ።';
    if (mode === 'public' && fd.get('pin') !== fd.get('pin2')) return 'ሁለቱ መግቢያ ኮዶች አይመሳሰሉም።';
    if (fd.get('is_ethiopian') === 'on' && isNew && fd.getAll('languages').length === 0) return 'ቢያንስ አንድ ቋንቋ ይምረጡ።';
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Checks the browser can't do by itself; the "are you sure?" box only opens when nothing is missing.
    const missing = precheck(fd);
    if (missing) { setUploadError(missing); confirmed.current = false; return; }
    if (isNew && !confirmed.current) { setUploadError(null); setConfirming(true); return; }
    confirmed.current = false;
    setUploadError(null);
    if (mode === 'public') {
      setSlip(buildSlip(fd, education, work, photoPreview));
      setPinShown(String(fd.get('pin') ?? ''));
    }
    let eduRows = education;
    fd.set('work_json', JSON.stringify(workStatus === 'worker' ? work : []));
    try {
      setUploading(true);
      const photo = fd.get('photo_file');
      fd.delete('photo_file');
      if (photo instanceof File && photo.size > 0) {
        const blob = await resizeImage(photo, 1600, 0.85);
        fd.set('photo_path', await upload(mode, blob, 'photo.jpg'));
      } else if (initial.photo_path) {
        fd.set('photo_path', initial.photo_path);
      } else {
        throw new Error('ፎቶ ያስገቡ።');
      }
      const prior = fd.get('prior_school_file');
      fd.delete('prior_school_file');
      if (prior instanceof File && prior.size > 0) fd.set('prior_school_evidence', await upload(mode, prior, prior.name));
      if (fd.get('has_prior_school') === 'on' && !String(fd.get('prior_school_evidence') ?? '')) throw new Error('የቀድሞ ሰ/ት/ቤት ማስረጃ ያያይዙ።');
      eduRows = await Promise.all(education.map(async (row) => {
        const file = fd.get(`edu_file_${row._k}`);
        fd.delete(`edu_file_${row._k}`);
        return file instanceof File && file.size > 0 ? { ...row, evidence_path: await upload(mode, file, file.name) } : row;
      }));
      setEducation(eduRows);
      fd.set('education_json', JSON.stringify(eduRows.map(({ _k, ...rest }) => (void _k, rest))));
    } catch (err) {
      setUploadError((err as Error).message);
      return;
    } finally {
      setUploading(false);
    }
    startTransition(() => action(fd));
  }

  if (mode === 'public' && state.ok && state.regNo && state.appId) {
    return (
      <div className="slip-done">
        <div className="card no-print" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem' }}>✅</div>
          <h2 style={{ margin: '6px 0' }}>በተሳካ ሁኔታ ተመዝግበዋል</h2>
          <p className="muted" style={{ marginTop: 0 }}>የምዝገባ ቅጹን አውርደው (ወይም አትመው) ወደ <b>የሰው ሃብት አስተዳደር (ቢሮ ቁጥር 7)</b> ይዘው ይምጡ። ምዝገባዎ ሲጸድቅ መግባት ይችላሉ።</p>
          <div className="secret-box">
            <div className="secret-title">🔒 ምስጢራዊ መረጃ — የተማሪ መግቢያ ኮድ</div>
            <p className="small" style={{ margin: '4px 0 10px' }}>ይህ የእርስዎ የተማሪ መግቢያ ልዩ ኮድ ነው፤ ለማንም አያጋሩ።</p>
            <dl>
              <div><dt>የተጠቃሚ ስም</dt><dd dir="ltr">{state.regNo}</dd></div>
              <div><dt>መግቢያ ኮድ</dt><dd dir="ltr">{pinShown}</dd></div>
            </dl>
          </div>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => window.print()}>⬇ የምዝገባ ቅጹን አውርድ / አትም</button>
            <a className="btn secondary" href="/login">ይውጡ</a>
          </div>
          <p className="hint small muted">“አውርድ” ሲጫን የሚከፈተው መስኮት ላይ “Save as PDF” ይምረጡ።</p>
        </div>
        {slip && <RegistrationSlip slip={slip} regNo={state.regNo} appId={state.appId} />}
      </div>
    );
  }

  const busy = pending || uploading;
  const req = isNew ? <span className="req">*</span> : null;

  return (
    <form ref={formEl} onSubmit={onSubmit} className="member-form">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {applicationId && <input type="hidden" name="application_id" value={applicationId} />}
      <nav className="form-steps" aria-label="የቅጹ ክፍሎች">
        {[...SECTIONS, ...(mode === 'public' ? [['sec-code', 'መግቢያ ኮድ'] as const] : [])].map(([id, title], i) => <a key={id} href={`#${id}`}><span>{i + 1}</span>{title}</a>)}
      </nav>

      <Section n={1} id="sec-membership" title="የአባልነት መረጃ">
        <div className="photo-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoPreview ? <img src={photoPreview} alt="" /> : <div className="photo-placeholder">ፎቶ</div>}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="photo_file">የአባል ፎቶ {!initial.photo_path && <span className="req">*</span>}</label>
            <input id="photo_file" name="photo_file" type="file" accept="image/*" capture="environment" required={!initial.photo_path}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} />
            <span className="hint">መንፈሳዊ ጉርድ (3×4) ፎቶ።</span>
          </div>
        </div>
        <div className="form-grid">
          {initial.reg_no && (
            <div className="field"><span className="label">የምዝገባ መለያ ቁጥር</span><span className="pill" style={{ alignSelf: 'flex-start' }}>{initial.reg_no}</span></div>
          )}
          <div className="field">
            <label htmlFor="member_type">የአባልነት ሁኔታ <span className="req">*</span></label>
            <select id="member_type" name="member_type" value={memberType} onChange={(e) => setMemberType(e.target.value)}>
              {Object.entries(MEMBER_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {memberType === 'other' && (
            <div className="field"><label htmlFor="member_type_other">ሌላ (ይግለጹ) <span className="req">*</span></label>
              <input id="member_type_other" name="member_type_other" required defaultValue={initial.member_type_other ?? ''} /></div>
          )}
          <div className="field">
            <label htmlFor="joined_year">አገልግሎት የጀመሩበት ዓመት (ዓ.ም)</label>
            <input id="joined_year" name="joined_year" type="number" min={1980} max={thisYear} step={1} value={joined} onChange={(e) => setJoined(e.target.value)} placeholder="ለምሳሌ 2010" />
          </div>
          <div className="field">
            <span className="label">የአገልግሎት ቆይታ</span>
            <output className="readonly">{sundayAge === null ? '—' : sundayAge === 0 ? 'ከዚህ ዓመት ጀምሮ' : `${sundayAge} ዓመት`}</output>
          </div>
        </div>
        {isNew && mode !== 'public' && <p className="hint muted small" style={{ margin: 0 }}>የምዝገባ ቀኑ “አባል መዝግብ” ሲጫን በራሱ ይመዘገባል።</p>}
      </Section>

      <Section n={2} id="sec-personal" title="የግል መረጃ ዝርዝር">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="title">ማዕረግ</label>
            <select id="title" name="title" defaultValue={initial.title ?? ''}>
              <option value="">—</option>
              {Object.entries(TITLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="first_name">ስም <span className="req">*</span></label><input id="first_name" name="first_name" required defaultValue={first} /></div>
          <div className="field"><label htmlFor="father_name">የአባት ስም <span className="req">*</span></label><input id="father_name" name="father_name" required defaultValue={father} /></div>
          <div className="field"><label htmlFor="grandfather_name">የአያት ስም <span className="req">*</span></label><input id="grandfather_name" name="grandfather_name" required defaultValue={grand} /></div>
          <div className="field"><label htmlFor="mother_name">የእናት ስም {req}</label><input id="mother_name" name="mother_name" required={isNew} defaultValue={initial.mother_name ?? ''} /></div>
          <div className="field"><label htmlFor="christian_name">የክርስትና ስም {req}</label><input id="christian_name" name="christian_name" required={isNew} defaultValue={initial.christian_name ?? ''} /></div>
          <div className="field"><label htmlFor="baptism_church">ክርስትና የተነሱበት ቤተ ክርስቲያን</label><input id="baptism_church" name="baptism_church" defaultValue={initial.baptism_church ?? ''} /></div>
          <div className="field">
            <span className="label">የትውልድ ቀን (ዓ.ም) {req}</span>
            <EcDatePicker name="dob" defaultIso={initial.dob} yearsBack={100} yearsForward={0} onChange={setDob} required={isNew} />
          </div>
          <div className="field">
            <span className="label">እድሜ</span>
            <output className="readonly">{dob ? `${age} ዓመት` : '—'}</output>
          </div>
          <div className="field">
            <label htmlFor="sex">ፆታ <span className="req">*</span></label>
            <select id="sex" name="sex" required defaultValue={initial.sex ?? ''}>
              <option value="" disabled>ይምረጡ</option>
              {Object.entries(SEX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="marital_status">የትዳር ሁኔታ {req}</label>
            <select id="marital_status" name="marital_status" required={isNew} defaultValue={initial.marital_status ?? ''}>
              <option value="">ይምረጡ</option>
              {Object.entries(MARITAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="geez_level">የግዕዝ ችሎታ</label>
            <select id="geez_level" name="geez_level" defaultValue={initial.geez_level ?? 'none'}>
              {Object.entries(GEEZ_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" name="is_ethiopian" checked={isEthiopian} onChange={(e) => setIsEthiopian(e.target.checked)} />
          ዜግነት ኢትዮጵያዊ
        </label>
        <div className="form-grid">
          {isEthiopian ? (
            <div className="field">
              <label htmlFor="languages">ቋንቋ (ብዙ መምረጥ ይቻላል)</label>
              <MultiSelect id="languages" name="languages" options={LANG_OPTIONS} defaultValue={initLangs} placeholder="ቋንቋዎችን ይምረጡ" />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="nationality">ሌላ ዜግነት <span className="req">*</span></label>
                <input id="nationality" name="nationality" required defaultValue={initial.nationality ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="language_other">ቋንቋ</label>
                <input id="language_other" name="language_other" placeholder="በኮማ ይለዩ (ለምሳሌ English, Arabic)" defaultValue={(initial.is_ethiopian === false ? initLangs : otherLangs).join(', ')} />
              </div>
            </>
          )}
        </div>
      </Section>

      <Section n={3} id="sec-address" title="የአባሉ አድራሻ">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="region">ክልል</label>
            <select id="region" name="region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">—</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="city">ከተማ</label><input id="city" name="city" defaultValue={initial.city ?? (region === 'አዲስ አበባ' ? 'አዲስ አበባ' : '')} /></div>
          <div className="field">
            <label htmlFor="sub_city">ክፍለ ከተማ</label>
            {region === 'አዲስ አበባ' ? (
              <select id="sub_city" name="sub_city" defaultValue={initial.sub_city ?? (initial.id ? '' : 'አቃቂ ቃሊቲ')}>
                <option value="">—</option>
                {SUB_CITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : <input id="sub_city" name="sub_city" defaultValue={initial.sub_city ?? ''} />}
          </div>
          <div className="field"><label htmlFor="woreda">ወረዳ</label><input id="woreda" name="woreda" defaultValue={initial.woreda ?? ''} /></div>
          <div className="field"><label htmlFor="house_no">የቤት ቁጥር</label><input id="house_no" name="house_no" defaultValue={initial.house_no ?? ''} placeholder="ካለ" /></div>
          <div className="field"><label htmlFor="phone">ስልክ {mode === 'public' && <span className="req">*</span>}</label><input id="phone" name="phone" type="tel" dir="ltr" placeholder="09/07…" required={mode === 'public'} defaultValue={initial.phone ?? ''} /></div>
          <div className="field"><label htmlFor="phone2">ሁለተኛ ስልክ</label><input id="phone2" name="phone2" type="tel" dir="ltr" placeholder="09/07…" defaultValue={initial.phone2 ?? ''} /></div>
          <div className="field"><label htmlFor="email">ኢሜይል</label><input id="email" name="email" type="email" dir="ltr" defaultValue={initial.email ?? ''} /></div>
          <div className="field"><label htmlFor="telegram_username">Telegram Username {req}</label><input id="telegram_username" name="telegram_username" dir="ltr" placeholder="@username" required={isNew} pattern="@?[A-Za-z0-9_]{5,32}" title="5–32 ፊደላት (A-Z, 0-9, _)" defaultValue={initial.telegram_username ?? ''} /></div>
        </div>
      </Section>

      <Section n={4} id="sec-contacts" title="ንሰሐ አባት እና የአደጋ ጊዜ ተጠሪ">
        <div className="sub-head">የንሰሐ አባት</div>
        <div className="form-grid">
          <div className="field"><label htmlFor="confessor_name">ስም</label><input id="confessor_name" name="confessor_name" defaultValue={initial.confessor_name ?? ''} /></div>
          <div className="field"><label htmlFor="confessor_phone">ስልክ</label><input id="confessor_phone" name="confessor_phone" type="tel" dir="ltr" defaultValue={initial.confessor_phone ?? ''} /></div>
        </div>
        <div className="sub-head">የአደጋ ጊዜ ተጠሪ</div>
        <div className="form-grid">
          <div className="field"><label htmlFor="emergency_name">ሙሉ ስም {req}</label><input id="emergency_name" name="emergency_name" required={isNew} defaultValue={initial.emergency_name ?? ''} /></div>
          <div className="field">
            <label htmlFor="emergency_relation">ዝምድና {req}</label>
            <input id="emergency_relation" name="emergency_relation" list="relations" required={isNew} defaultValue={initial.emergency_relation ?? ''} placeholder="ለምሳሌ እናት" />
            <datalist id="relations">{EMERGENCY_RELATIONS.map((r) => <option key={r} value={r} />)}</datalist>
          </div>
          <div className="field"><label htmlFor="emergency_phone">ስልክ {req}</label><input id="emergency_phone" name="emergency_phone" type="tel" dir="ltr" required={isNew} defaultValue={initial.emergency_phone ?? ''} /></div>
        </div>
      </Section>

      <Section n={5} id="sec-education" title="የትምህርት መረጃ">
        <div className="sub-head">አለማዊ ትምህርት</div>
        {education.map((e, i) => (
          <div key={e._k ?? i} className="repeat-row">
            <div className="repeat-head">
              <b>{i + 1}.</b>
              <button type="button" className="btn sm danger" onClick={() => setEducation(education.length > 1 ? education.filter((_, j) => j !== i) : [emptyEducation()])}>🗑 አጥፋ</button>
            </div>
            <div className="form-grid">
              <div className="field"><label>የትምህርት ደረጃ</label>
                <select value={e.level} onChange={(x) => patchEdu(i, { level: x.target.value })}>
                  <option value="">ይምረጡ</option>
                  {EDUCATION_LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select></div>
              <div className="field"><label>የትምህርት ዘርፍ</label><input value={e.field} onChange={(x) => patchEdu(i, { field: x.target.value })} placeholder="ለምሳሌ ሒሳብ አያያዝ" /></div>
              <div className="field"><label>የትምህርት ተቋም</label><input value={e.institution} onChange={(x) => patchEdu(i, { institution: x.target.value })} /></div>
              <YearsFields e={e} set={(p) => patchEdu(i, p)} nowLabel="እስከ አሁን በትምህርት ላይ" />
              <div className="field">
                <label>የትምህርት ማስረጃ ፋይል (ካለ)</label>
                <input name={`edu_file_${e._k}`} type="file" accept="image/*,.pdf" />
                {e.evidence_path && <span className="hint">ማስረጃ ተያይዟል — አዲስ ፋይል ከመረጡ ይተካል</span>}
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn sm secondary" onClick={() => setEducation([...education, emptyEducation()])}>+ ተጨማሪ የትምህርት መረጃ</button>

        <label className="check">
          <input type="checkbox" name="has_prior_school" checked={hasPrior} onChange={(e) => setHasPrior(e.target.checked)} />
          ከዚህ በፊት ሌላ ሰ/ት/ቤት አገልግለዋል
        </label>
        {hasPrior && (
          <div className="form-grid">
            <div className="field"><label htmlFor="prior_school_name">የሰ/ት/ቤቱ ስም <span className="req">*</span></label><input id="prior_school_name" name="prior_school_name" required defaultValue={initial.prior_school?.name ?? ''} /></div>
            <div className="field"><label htmlFor="prior_school_years">የአገልግሎት ዓመታት <span className="req">*</span></label><input id="prior_school_years" name="prior_school_years" type="number" min={1} max={80} required defaultValue={initial.prior_school?.years ?? ''} /></div>
            <div className="field">
              <label htmlFor="prior_school_file">ማስረጃ <span className="req">*</span></label>
              <input id="prior_school_file" name="prior_school_file" type="file" accept="image/*,.pdf" required={!initial.prior_school?.evidence_path} />
              <input type="hidden" name="prior_school_evidence" defaultValue={initial.prior_school?.evidence_path ?? ''} />
              {initial.prior_school?.evidence_path && <span className="hint">ማስረጃ ተያይዟል — አዲስ ፋይል ከመረጡ ይተካል</span>}
            </div>
          </div>
        )}
      </Section>

      <Section n={6} id="sec-work" title="የሥራ መረጃ">
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="work_status">አሁን ያሉበት ሁኔታ <span className="req">*</span></label>
          <select id="work_status" name="work_status" required value={workStatus} onChange={(e) => setWorkStatus(e.target.value)}>
            <option value="" disabled>ይምረጡ</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {workStatus === 'worker' && (
          <>
            {work.map((w, i) => (
              <div key={i} className="repeat-row">
                <div className="repeat-head">
                  <b>{i + 1}.</b>
                  <button type="button" className="btn sm danger" onClick={() => setWork(work.length > 1 ? work.filter((_, j) => j !== i) : [emptyWork()])}>🗑 አጥፋ</button>
                </div>
                <div className="form-grid">
                  <div className="field"><label>የሥራ ዘርፍ</label>
                    <select value={w.field} onChange={(x) => patchWork(i, { field: x.target.value })}>
                      <option value="">ይምረጡ</option>
                      {WORK_SECTORS.map((l) => <option key={l}>{l}</option>)}
                    </select></div>
                  <div className="field"><label>መሥሪያ ቤት</label><input value={w.workplace} onChange={(x) => patchWork(i, { workplace: x.target.value })} placeholder="የመሥሪያ ቤት ስም" /></div>
                  <YearsFields e={w} set={(p) => patchWork(i, p)} nowLabel="እስከ አሁን በሥራ ላይ" />
                </div>
              </div>
            ))}
            <button type="button" className="btn sm secondary" onClick={() => setWork([...work, emptyWork()])}>+ ተጨማሪ የሥራ መረጃ</button>
          </>
        )}
      </Section>

      <Section n={7} id="sec-depts" title="ዝንባሌ">
        <div className="field" style={{ maxWidth: 520 }}>
          <label htmlFor="depts">በየትኛው ክፍል ቀርበው ማገልገል ይፈልጋሉ? (ቢበዛ 2)</label>
          <MultiSelect id="depts" name="depts" options={DEPT_OPTIONS} defaultValue={initial.depts ?? []} max={2} placeholder="ክፍል ይምረጡ" />
        </div>
      </Section>

      {mode === 'public' && (
        <Section n={8} id="sec-code" title="መግቢያ ኮድ">
          <p className="muted small" style={{ marginTop: 0 }}>ባለ 6 አሃዝ መግቢያ ኮድ ይፍጠሩ። ምዝገባዎ ሲጸድቅ በምዝገባ ቁጥርዎ እና በዚህ ኮድ ይገባሉ። ለማንም አያጋሩ።</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="pin">መግቢያ ኮድ (6 አሃዝ) <span className="req">*</span></label>
              <input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="new-password" /></div>
            <div className="field"><label htmlFor="pin2">ኮዱን ይድገሙ <span className="req">*</span></label>
              <input id="pin2" name="pin2" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="new-password" /></div>
          </div>
        </Section>
      )}

      <div className="form-submit">
        {(uploadError || state.error) && <div className="alert error">{uploadError || state.error}</div>}
        <button className="btn" disabled={busy}>
          {uploading ? 'ፋይል በመጫን ላይ…' : pending ? 'በማስቀመጥ ላይ…'
            : mode === 'public' ? 'አስቀምጥ (ተመዝገብ)' : mode === 'approve' ? 'አጽድቅና አባል መዝግብ' : initial.id ? 'ለውጥ አስቀምጥ' : 'አባል መዝግብ'}
        </button>
      </div>

      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="modal">
            <div style={{ fontSize: '2rem' }} aria-hidden>❓</div>
            <h3 id="confirm-title">ያስገቡት መረጃ ትክክለኛ መሆኑን እርግጠኛ ኖት?</h3>
            <p className="muted small">ከመላክዎ በፊት ስምዎን፣ ስልክዎን እና ፎቶዎን እንደገና ይመልከቱ።</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn secondary" autoFocus onClick={() => setConfirming(false)}>ለመመለስ</button>
              <button type="button" className="btn" onClick={() => { setConfirming(false); confirmed.current = true; formEl.current?.requestSubmit(); }}>
                እርግጠኛ ነኝ
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
