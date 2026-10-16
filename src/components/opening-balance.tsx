import type { SupabaseClient } from '@supabase/supabase-js';
import { formatBirr } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { Modal } from './modal';
import { MediaForm } from './media-form';
import { EcDatePicker } from './ec-date-picker';
import { setOpeningBalance } from '@/lib/actions/finance';

/** መነሻ ሂሳብ: shown as a chip; ሒሳብና ንብረት can set / change it. */
export async function OpeningBalance({ supabase, canEdit }: { supabase: SupabaseClient; canEdit: boolean }) {
  const { data: w } = await supabase.from('wallet_settings').select('opening_balance, as_of').maybeSingle();
  const opening = Number(w?.opening_balance ?? 0);
  return (
    <span className="opening-wrap">
      <span className={`opening-chip ${w?.as_of ? '' : 'missing'}`}>
        መነሻ ሂሳብ፦ <b>{w?.as_of ? formatBirr(opening) : 'አልተመዘገበም'}</b>{w?.as_of && <span className="small"> · ከ{formatEc(w.as_of)}</span>}
      </span>
      {canEdit && (
        <Modal label={w?.as_of ? '✎ መነሻ ሂሳብ' : '+ መነሻ ሂሳብ አስገባ'} title="መነሻ ሂሳብ (Opening balance)" sub="ክትትል ሲጀመር በሰንበት ት/ቤቱ እጅ የነበረው ገንዘብ" size="sm"
          btnClass={w?.as_of ? 'btn sm secondary' : 'btn sm green'}>
          <MediaForm action={setOpeningBalance} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
            <div className="field"><label>መጠን (ብር)</label><input name="opening_balance" type="number" min={0} step="0.01" defaultValue={opening} required /></div>
            <div className="field"><span className="label">ከዚህ ቀን ጀምሮ (ዓ.ም)</span><EcDatePicker name="as_of" defaultIso={w?.as_of ?? todayIsoAddis()} yearsBack={5} yearsForward={0} required /></div>
          </MediaForm>
        </Modal>
      )}
    </span>
  );
}
