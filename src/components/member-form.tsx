'use client';
import { useActionState, useState, startTransition, useRef } from 'react';
import { saveMember, type MemberFormState } from '@/app/staff/members/actions';
import { createClient } from '@/lib/supabase/client';
import { EcDatePicker } from './ec-date-picker';
import { ageFromIso } from '@/lib/ethiopian-calendar';
import {
  DEPARTMENTS, GEEZ_LEVEL, LANGUAGES, MEMBER_STATUS, SEX, SUB_CITIES, TITLES, WORK_STATUS,
} from '@/lib/constants';

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
  language?: string | null;
  geez_level?: string;
  is_ethiopian?: boolean;
  nationality?: string | null;
  prior_school?: { name?: string | null; years?: number | null; evidence_path?: string | null } | null;
  secular_school?: { name?: string | null; evidence_path?: string | null } | null;
  depts?: string[];
};

const MAX_FILE = 10 * 1024 * 1024;

async function uploadEvidence(file: File): Promise<string> {
  if (file.size > MAX_FILE) throw new Error('ፋይሉ ከ10MB በላይ ነው።');
  const supabase = createClient();
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-60);
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
  const [hasSecular, setHasSecular] = useState(!!initial.secular_school);
  const [isEthiopian, setIsEthiopian] = useState(initial.is_ethiopian ?? true);
  const knownLang = !initial.language || (LANGUAGES as readonly string[]).includes(initial.language);
  const [language, setLanguage] = useState(knownLang ? initial.language ?? '' : 'ሌላ');
  const formRef = useRef<HTMLFormElement>(null);

  const age = ageFromIso(dob);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const fd = new FormData(e.currentTarget);
    try {
      setUploading(true);
      for (const key of ['prior_school', 'secular_school'] as const) {
        const file = fd.get(`${key}_file`);
        fd.delete(`${key}_file`);
        if (file instanceof File && file.size > 0) {
          fd.set(`${key}_evidence`, await uploadEvidence(file));
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

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="form-section">ግላዊ መረጃ</div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="full_name">ሙሉ ስም <span className="req">*</span></label>
          <input id="full_name" name="full_name" required defaultValue={initial.full_name} />
        </div>
        <div className="field">
          <label htmlFor="sex">ፆታ <span className="req">*</span></label>
          <select id="sex" name="sex" required defaultValue={initial.sex ?? ''}>
            <option value="" disabled>ይምረጡ</option>
            {Object.entries(SEX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">ማዕረግ</label>
          <select id="title" name="title" defaultValue={initial.title ?? ''}>
            <option value="">—</option>
            {Object.entries(TITLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="work_status">ሁኔታ <span className="req">*</span></label>
          <select id="work_status" name="work_status" required defaultValue={initial.work_status ?? ''}>
            <option value="" disabled>ይምረጡ</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">የትውልድ ቀን (ዓ.ም)</span>
          <EcDatePicker name="dob" defaultIso={initial.dob} yearsBack={100} yearsForward={0} onChange={setDob} />
          <span className="hint">
            {dob ? `ዕድሜ፦ ${age} · እ.ኤ.አ ${dob}` : 'ቀን፣ ወር እና ዓ.ም ይምረጡ'}
          </span>
        </div>
        <div className="field">
          <label htmlFor="member_status">የአባልነት ሁኔታ <span className="req">*</span></label>
          <select id="member_status" name="member_status" required defaultValue={initial.member_status ?? 'new'}>
            {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="form-section">የትምህርት ታሪክ</div>
      <label className="check">
        <input type="checkbox" name="has_prior_school" checked={hasPrior} onChange={(e) => setHasPrior(e.target.checked)} />
        ከዚህ በፊት ሌላ ሰ/ት/ቤት አገልግለዋል
      </label>
      {hasPrior && (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="prior_school_name">የሰ/ት/ቤቱ ስም</label>
            <input id="prior_school_name" name="prior_school_name" defaultValue={initial.prior_school?.name ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="prior_school_years">የአገልግሎት ዓመታት</label>
            <input id="prior_school_years" name="prior_school_years" type="number" min={0} max={80}
              defaultValue={initial.prior_school?.years ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="prior_school_file">ማስረጃ</label>
            <input id="prior_school_file" name="prior_school_file" type="file" accept="image/*,.pdf" />
            <input type="hidden" name="prior_school_evidence" defaultValue={initial.prior_school?.evidence_path ?? ''} />
            {initial.prior_school?.evidence_path && <span className="hint">ማስረጃ ተያይዟል — አዲስ ፋይል ከመረጡ ይተካል</span>}
          </div>
        </div>
      )}
      <label className="check">
        <input type="checkbox" name="has_secular_school" checked={hasSecular} onChange={(e) => setHasSecular(e.target.checked)} />
        አለማዊ ትምህርት
      </label>
      {hasSecular && (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="secular_school_name">የትምህርት ቤቱ ስም</label>
            <input id="secular_school_name" name="secular_school_name" defaultValue={initial.secular_school?.name ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="secular_school_file">ማስረጃ</label>
            <input id="secular_school_file" name="secular_school_file" type="file" accept="image/*,.pdf" />
            <input type="hidden" name="secular_school_evidence" defaultValue={initial.secular_school?.evidence_path ?? ''} />
            {initial.secular_school?.evidence_path && <span className="hint">ማስረጃ ተያይዟል — አዲስ ፋይል ከመረጡ ይተካል</span>}
          </div>
        </div>
      )}

      <div className="form-section">ግንኙነት እና ቋንቋ</div>
      <label className="check">
        <input type="checkbox" name="is_ethiopian" checked={isEthiopian} onChange={(e) => setIsEthiopian(e.target.checked)} />
        ዜግነት ኢትዮጵያዊ
      </label>
      <div className="form-grid">
        {!isEthiopian && (
          <div className="field">
            <label htmlFor="nationality">ዜግነት <span className="req">*</span></label>
            <input id="nationality" name="nationality" required defaultValue={initial.nationality ?? ''} />
          </div>
        )}
        <div className="field">
          <label htmlFor="sub_city">ክፍለ ከተማ</label>
          <select id="sub_city" name="sub_city" defaultValue={initial.sub_city ?? ''}>
            <option value="">—</option>
            {SUB_CITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="language">ቋንቋ</label>
          <select id="language" name="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">—</option>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        {language === 'ሌላ' && (
          <div className="field">
            <label htmlFor="language_other">ሌላ ቋንቋ</label>
            <input id="language_other" name="language_other" defaultValue={knownLang ? '' : initial.language ?? ''} />
          </div>
        )}
        <div className="field">
          <label htmlFor="geez_level">የግዕዝ ችሎታ</label>
          <select id="geez_level" name="geez_level" defaultValue={initial.geez_level ?? 'none'}>
            {Object.entries(GEEZ_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="phone">ስልክ</label>
          <input id="phone" name="phone" type="tel" dir="ltr" placeholder="09…" defaultValue={initial.phone ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" dir="ltr" defaultValue={initial.email ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="telegram_username">Telegram Username</label>
          <input id="telegram_username" name="telegram_username" dir="ltr" placeholder="@username"
            defaultValue={initial.telegram_username ?? ''} />
        </div>
      </div>

      <div className="form-section">ክፍል/ዝግጅት መረጣ</div>
      <p className="hint muted small" style={{ marginTop: 0 }}>
        የተመረጡት ክፍሎች የአባሉ ንዑስ-አባልነት ናቸው። ክትትል ግን ለሁሉም አባላት ይያዛል።
      </p>
      <div className="check-grid">
        {DEPARTMENTS.map((d) => (
          <label key={d.code} className="check">
            <input type="checkbox" name="depts" value={d.code} defaultChecked={initial.depts?.includes(d.code)} />
            {d.name}
          </label>
        ))}
      </div>

      {(uploadError || state.error) && <div className="alert error">{uploadError || state.error}</div>}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" disabled={busy}>
          {uploading ? 'ፋይል በመጫን ላይ…' : pending ? 'በማስቀመጥ ላይ…' : initial.id ? 'ለውጥ አስቀምጥ' : 'አባል መዝግብ'}
        </button>
      </div>
    </form>
  );
}
