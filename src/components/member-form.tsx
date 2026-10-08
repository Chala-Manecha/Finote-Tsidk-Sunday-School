'use client';
import { useActionState, useState, startTransition, useRef } from 'react';
import { saveMember, type MemberFormState } from '@/app/staff/members/actions';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/client/upload';
import { EcDatePicker } from './ec-date-picker';
import { ageFromIso, todayIsoAddis } from '@/lib/ethiopian-calendar';
import {
  DEPARTMENTS, EDUCATION_LEVELS, EMERGENCY_RELATIONS, GEEZ_LEVEL, LANGUAGES, MARITAL_STATUS, MEMBER_STATUS,
  REGIONS, SEX, SUB_CITIES, TITLES, WORK_SECTORS, WORK_STATUS,
} from '@/lib/constants';
import { emptyEducation, emptyWork, type EducationEntry, type WorkEntry } from '@/lib/member-details';

export type MemberInitial = {
  id?: string;
  full_name?: string;
  sex?: string;
  title?: string | null;
  work_status?: string;
  member_status?: string;
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
  doc_no?: string | null;
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

const SECTIONS = [
  ['sec-membership', 'የአባልነት መረጃ'],
  ['sec-personal', 'ግላዊ መረጃ'],
  ['sec-address', 'አድራሻ'],
  ['sec-contacts', 'ንሰሐ አባት እና ተጠሪ'],
  ['sec-education', 'ትምህርት'],
  ['sec-work', 'ሥራ'],
  ['sec-depts', 'ክፍል መረጣ'],
] as const;

/** Splits an old single full_name into ስም / የአባት ስም / የአያት ስም. */
function nameParts(i: MemberInitial): [string, string, string] {
  if (i.first_name || i.father_name) return [i.first_name ?? '', i.father_name ?? '', i.grandfather_name ?? ''];
  const w = (i.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  return [w[0] ?? '', w[1] ?? '', w.slice(2).join(' ')];
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
      <div className="field"><label>ያበቁበት ዓመት (ዓ.ም)</label>
        <input type="number" min={1900} max={2100} disabled={e.current} value={e.current ? '' : (e.end_year ?? '')} onChange={(x) => set({ end_year: num(x.target.value) })} /></div>
      <label className="check" style={{ alignSelf: 'end' }}>
        <input type="checkbox" checked={e.current} onChange={(x) => set({ current: x.target.checked })} /> {nowLabel}
      </label>
    </>
  );
}


const MAX_FILE = 10 * 1024 * 1024;

async function uploadEvidence(file: File | Blob, name = 'file'): Promise<string> {
  if (file.size > MAX_FILE) throw new Error('ፋይሉ ከ10MB በላይ ነው።');
  const supabase = createClient();
  const safe = name.replace(/[^\w.\-]+/g, '_').slice(-60);
  const path = `members/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('member-docs').upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) throw new Error(`ፋይል መጫን አልተቻለም፦ ${error.message}`);
  return path;
}

export function MemberForm({ initial = {} }: { initial?: MemberInitial }) {
  const [state, action, pending] = useActionState<MemberFormState, FormData>(saveMember, {});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(initial.dob ?? null);
  const [hasPrior, setHasPrior] = useState(!!initial.prior_school);
  const [isEthiopian, setIsEthiopian] = useState(initial.is_ethiopian ?? true);
  const [region, setRegion] = useState(initial.region ?? (initial.id ? (initial.sub_city ? 'አዲስ አበባ' : '') : 'አዲስ አበባ'));
  const initLangs = initial.languages ?? [];
  const otherLangs = initLangs.filter((l) => !(LANGUAGES as readonly string[]).includes(l));
  const [langOther, setLangOther] = useState(otherLangs.length > 0);
  const [depts, setDepts] = useState<string[]>(initial.depts ?? []);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photo_url ?? null);
  const [education, setEducation] = useState<EducationEntry[]>(initial.education?.length ? initial.education : [emptyEducation()]);
  const [work, setWork] = useState<WorkEntry[]>(initial.work?.length ? initial.work : [emptyWork()]);
  const formRef = useRef<HTMLFormElement>(null);
  const [first, father, grand] = nameParts(initial);
  const isNew = !initial.id;

  const age = ageFromIso(dob);
  const patchEdu = (i: number, p: Partial<EducationEntry>) => setEducation(education.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const patchWork = (i: number, p: Partial<WorkEntry>) => setWork(work.map((e, j) => (j === i ? { ...e, ...p } : e)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('education_json', JSON.stringify(education));
    fd.set('work_json', JSON.stringify(work));
    try {
      setUploading(true);
      const photo = fd.get('photo_file');
      fd.delete('photo_file');
      if (photo instanceof File && photo.size > 0) {
        const blob = await resizeImage(photo, 1600, 0.85);
        fd.set('photo_path', await uploadEvidence(blob, 'photo.jpg'));
      } else if (!initial.photo_path) {
        throw new Error('ፎቶ ያስገቡ።');
      }
      for (const key of ['prior_school', 'secular_school'] as const) {
        const file = fd.get(`${key}_file`);
        fd.delete(`${key}_file`);
        if (file instanceof File && file.size > 0) {
          fd.set(`${key}_evidence`, await uploadEvidence(file, file.name));
        }
      }
    } catch (err) {
      setUploadError((err as Error).message);
      return;
    } finally {
      setUploading(false);
    }
    startTransition(() => action(fd));
  }

  const busy = pending || uploading;
  const req = isNew ? <span className="req">*</span> : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="member-form">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <nav className="form-steps" aria-label="የቅጹ ክፍሎች">
        {SECTIONS.map(([id, label], i) => <a key={id} href={`#${id}`}><span>{i + 1}</span>{label}</a>)}
      </nav>

      <Section n={1} id="sec-membership" title="የአባልነት መረጃ">
        <div className="photo-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoPreview ? <img src={photoPreview} alt="" /> : <div className="photo-placeholder">ፎቶ</div>}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="photo_file">የአባል ፎቶ {!initial.photo_path && <span className="req">*</span>}</label>
            <input id="photo_file" name="photo_file" type="file" accept="image/*" capture="environment"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} />
            <span className="hint">ሙሉ ቁመት የሚያሳይ ፎቶ ቢሆን ይመረጣል።</span>
          </div>
        </div>
        <div className="form-grid">
          {initial.reg_no && (
            <div className="field"><span className="label">የምዝገባ መለያ ቁጥር</span><span className="pill" style={{ alignSelf: 'flex-start' }}>{initial.reg_no}</span></div>
          )}
          <div className="field">
            <span className="label">የአባልነት ምዝገባ ቀን (ዓ.ም) <span className="req">*</span></span>
            <EcDatePicker name="registered_on" defaultIso={initial.registered_on ?? todayIsoAddis()} yearsBack={30} yearsForward={0} required />
          </div>
          <div className="field">
            <label htmlFor="doc_no">የዶክመንት (የወረቀት ፎርም) ቁጥር</label>
            <input id="doc_no" name="doc_no" defaultValue={initial.doc_no ?? ''} placeholder="ካለ" />
          </div>
          <div className="field">
            <label htmlFor="member_status">የአባልነት ሁኔታ <span className="req">*</span></label>
            <select id="member_status" name="member_status" required defaultValue={initial.member_status ?? 'new'}>
              {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="joined_year">ሰንበት ት/ቤቱን የተቀላቀሉበት ዓመት (ዓ.ም)</label>
            <input id="joined_year" name="joined_year" type="number" min={1980} max={2100} step={1} defaultValue={initial.joined_year ?? ''} placeholder="ለምሳሌ 2010" />
            <span className="hint">በመልቀቂያ ምስክር ወረቀት ላይ ለአባልነት ዘመን ይውላል።</span>
          </div>
        </div>
      </Section>

      <Section n={2} id="sec-personal" title="ግላዊ መረጃ">
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
          <div className="field"><label htmlFor="christian_name">የክርስትና ስም</label><input id="christian_name" name="christian_name" defaultValue={initial.christian_name ?? ''} /></div>
          <div className="field"><label htmlFor="baptism_church">ክርስትና የተነሱበት ቤተ ክርስቲያን</label><input id="baptism_church" name="baptism_church" defaultValue={initial.baptism_church ?? ''} /></div>
          <div className="field">
            <span className="label">የትውልድ ቀን (ዓ.ም) {req}</span>
            <EcDatePicker name="dob" defaultIso={initial.dob} yearsBack={100} yearsForward={0} onChange={setDob} required={isNew} />
            <span className="hint">{dob ? `ዕድሜ፦ ${age} · እ.ኤ.አ ${dob}` : 'ቀን፣ ወር እና ዓ.ም ይምረጡ'}</span>
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
        {!isEthiopian && (
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="nationality">ዜግነት <span className="req">*</span></label>
            <input id="nationality" name="nationality" required defaultValue={initial.nationality ?? ''} />
          </div>
        )}
        <div className="field">
          <span className="label">ቋንቋ (ብዙ መምረጥ ይቻላል)</span>
          <div className="check-grid">
            {LANGUAGES.filter((l) => l !== 'ሌላ').map((l) => (
              <label key={l} className="check" style={{ margin: 0 }}>
                <input type="checkbox" name="languages" value={l} defaultChecked={initLangs.includes(l)} /> {l}
              </label>
            ))}
            <label className="check" style={{ margin: 0 }}>
              <input type="checkbox" checked={langOther} onChange={(e) => setLangOther(e.target.checked)} /> ሌላ
            </label>
          </div>
          {langOther && <input name="language_other" placeholder="ሌላ ቋንቋ (በኮማ ይለዩ)" defaultValue={otherLangs.join(', ')} />}
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
              <select id="sub_city" name="sub_city" defaultValue={initial.sub_city ?? ''}>
                <option value="">—</option>
                {SUB_CITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : <input id="sub_city" name="sub_city" defaultValue={initial.sub_city ?? ''} />}
          </div>
          <div className="field"><label htmlFor="woreda">ወረዳ</label><input id="woreda" name="woreda" defaultValue={initial.woreda ?? ''} /></div>
          <div className="field"><label htmlFor="house_no">የቤት ቁጥር</label><input id="house_no" name="house_no" defaultValue={initial.house_no ?? ''} placeholder="ካለ" /></div>
          <div className="field"><label htmlFor="phone">ስልክ</label><input id="phone" name="phone" type="tel" dir="ltr" placeholder="09/07…" defaultValue={initial.phone ?? ''} /></div>
          <div className="field"><label htmlFor="phone2">ሁለተኛ ስልክ</label><input id="phone2" name="phone2" type="tel" dir="ltr" placeholder="09/07…" defaultValue={initial.phone2 ?? ''} /></div>
          <div className="field"><label htmlFor="email">ኢሜይል</label><input id="email" name="email" type="email" dir="ltr" defaultValue={initial.email ?? ''} /></div>
          <div className="field"><label htmlFor="telegram_username">Telegram Username</label><input id="telegram_username" name="telegram_username" dir="ltr" placeholder="@username" defaultValue={initial.telegram_username ?? ''} /></div>
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
          <div className="field"><label htmlFor="emergency_name">ሙሉ ስም</label><input id="emergency_name" name="emergency_name" defaultValue={initial.emergency_name ?? ''} /></div>
          <div className="field">
            <label htmlFor="emergency_relation">ዝምድና</label>
            <input id="emergency_relation" name="emergency_relation" list="relations" defaultValue={initial.emergency_relation ?? ''} placeholder="ለምሳሌ እናት" />
            <datalist id="relations">{EMERGENCY_RELATIONS.map((r) => <option key={r} value={r} />)}</datalist>
          </div>
          <div className="field"><label htmlFor="emergency_phone">ስልክ</label><input id="emergency_phone" name="emergency_phone" type="tel" dir="ltr" defaultValue={initial.emergency_phone ?? ''} /></div>
        </div>
      </Section>

      <Section n={5} id="sec-education" title="የትምህርት መረጃ">
        <div className="sub-head">አለማዊ ትምህርት</div>
        {education.map((e, i) => (
          <div key={i} className="repeat-row">
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
            </div>
          </div>
        ))}
        <button type="button" className="btn sm secondary" onClick={() => setEducation([...education, emptyEducation()])}>+ ተጨማሪ የትምህርት ማስረጃ</button>
        <div className="field" style={{ marginTop: 12, maxWidth: 420 }}>
          <label htmlFor="secular_school_file">የትምህርት ማስረጃ ፋይል (ካለ)</label>
          <input id="secular_school_file" name="secular_school_file" type="file" accept="image/*,.pdf" />
          <input type="hidden" name="secular_school_evidence" defaultValue={initial.secular_school?.evidence_path ?? ''} />
          {initial.secular_school?.evidence_path && <span className="hint">ማስረጃ ተያይዟል — አዲስ ፋይል ከመረጡ ይተካል</span>}
        </div>

        <div className="sub-head">መንፈሳዊ አገልግሎት</div>
        <label className="check">
          <input type="checkbox" name="has_prior_school" checked={hasPrior} onChange={(e) => setHasPrior(e.target.checked)} />
          ከዚህ በፊት ሌላ ሰ/ት/ቤት አገልግለዋል
        </label>
        {hasPrior && (
          <div className="form-grid">
            <div className="field"><label htmlFor="prior_school_name">የሰ/ት/ቤቱ ስም</label><input id="prior_school_name" name="prior_school_name" defaultValue={initial.prior_school?.name ?? ''} /></div>
            <div className="field"><label htmlFor="prior_school_years">የአገልግሎት ዓመታት</label><input id="prior_school_years" name="prior_school_years" type="number" min={0} max={80} defaultValue={initial.prior_school?.years ?? ''} /></div>
            <div className="field">
              <label htmlFor="prior_school_file">ማስረጃ</label>
              <input id="prior_school_file" name="prior_school_file" type="file" accept="image/*,.pdf" />
              <input type="hidden" name="prior_school_evidence" defaultValue={initial.prior_school?.evidence_path ?? ''} />
              {initial.prior_school?.evidence_path && <span className="hint">ማስረጃ ተያይዟል — አዲስ ፋይል ከመረጡ ይተካል</span>}
            </div>
          </div>
        )}
      </Section>

      <Section n={6} id="sec-work" title="የሥራ መረጃ">
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="work_status">አሁን ያሉበት ሁኔታ <span className="req">*</span></label>
          <select id="work_status" name="work_status" required defaultValue={initial.work_status ?? ''}>
            <option value="" disabled>ይምረጡ</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
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
      </Section>

      <Section n={7} id="sec-depts" title="ክፍል መረጣ">
        <p className="hint muted small" style={{ marginTop: 0 }}>በየትኛው ክፍል ስር በንዑስ አባልነት ማገልገል ይፈልጋሉ? (ቢበዛ 2)</p>
        <div className="check-grid">
          {DEPARTMENTS.map((d) => (
            <label key={d.code} className="check">
              <input
                type="checkbox" name="depts" value={d.code}
                checked={depts.includes(d.code)}
                disabled={!depts.includes(d.code) && depts.length >= 2}
                onChange={(e) => setDepts(e.target.checked ? [...depts, d.code] : depts.filter((x) => x !== d.code))}
              />
              {d.name}
            </label>
          ))}
        </div>
      </Section>

      <div className="form-submit">
        {(uploadError || state.error) && <div className="alert error">{uploadError || state.error}</div>}
        <button className="btn" disabled={busy}>
          {uploading ? 'ፋይል በመጫን ላይ…' : pending ? 'በማስቀመጥ ላይ…' : initial.id ? 'ለውጥ አስቀምጥ' : 'አባል መዝግብ'}
        </button>
      </div>
    </form>
  );
}
