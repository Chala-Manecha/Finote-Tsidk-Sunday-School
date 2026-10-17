import { createClient } from '@/lib/supabase/server';
import { MediaForm } from '@/components/media-form';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-button';
import { removeCoordinator, setCoordinator } from '@/lib/actions/abnet';

/** ትምህርት ክፍል: the one member who runs አብነት (signs in with their own member login). */
export async function CoordinatorBox() {
  const supabase = await createClient();
  const [{ data: c }, { data: members }] = await Promise.all([
    supabase.from('abnet_coordinator').select('member_id, set_at, members(full_name, reg_no)').maybeSingle(),
    supabase.from('members').select('full_name, reg_no').eq('is_active', true).order('full_name'),
  ]);
  const m = (c as { members?: { full_name: string; reg_no: string } | null } | null)?.members;
  return (
    <div className="coord-box no-print">
      <span>👤 የአብነት አስተባባሪ፦ {m ? <b>{m.full_name} <span className="small muted">{m.reg_no}</span></b> : <span className="muted">አልተመደበም</span>}</span>
      <span className="spacer" />
      <Modal label={m ? 'ቀይር' : '+ አስተባባሪ መድብ'} title="የአብነት አስተባባሪ" btnClass="btn xs secondary">
        <MediaForm action={setCoordinator} submitLabel="መድብ" card={false}>
          <p className="small muted" style={{ marginTop: 0 }}>
            አስተባባሪው በራሱ የአባል መግቢያ (የምዝገባ ቁጥርና ኮድ) ገብቶ <b>“አብነት”</b>ን ሙሉ በሙሉ ያስተዳድራል — መርሐ ግብር፣ መማሪያዎች፣ ማሕሌት፣ ነግስ፣ የበዓል መልዕክቶች። ሌሎች የትምህርት ክፍል ገጾችን አያይም።
          </p>
          <datalist id="coord-members">{(members ?? []).map((x) => <option key={x.reg_no} value={`${x.full_name} (${x.reg_no})`} />)}</datalist>
          <div className="field"><label htmlFor="coord-who">አባል</label><input id="coord-who" name="who" list="coord-members" required autoComplete="off" placeholder="ስም ወይም የምዝገባ ቁጥር ይጻፉ" /></div>
        </MediaForm>
      </Modal>
      {m && <ActionButton action={removeCoordinator} label="አንሳ" className="btn xs danger" confirmText={`${m.full_name} ከአስተባባሪነት ይነሱ?`} />}
    </div>
  );
}
