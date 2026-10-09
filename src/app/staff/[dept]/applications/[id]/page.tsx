import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { MemberForm, type MemberInitial } from '@/components/member-form';
import { MediaForm } from '@/components/media-form';
import { rejectApplication } from '@/lib/actions/applications';

/** HR reviews a self-registration in the normal member form; saving it registers the member. */
export default async function ReviewApplication({ params }: { params: Promise<{ dept: string; id: string }> }) {
  const { dept, id } = await params;
  if (dept !== 'hr') notFound();
  const supabase = await createClient();
  const { data: a } = await supabase.from('member_applications').select('id, reg_no, data, depts, status, created_at').eq('id', id).maybeSingle();
  if (!a) notFound();
  const d = a.data as MemberInitial;
  const photo_url = d.photo_path
    ? (await supabase.storage.from('member-docs').createSignedUrl(d.photo_path, 600)).data?.signedUrl ?? null
    : null;

  return (
    <>
      <div className="crumb"><Link href="/staff/hr/applications">የተመዝጋቢዎች ዝርዝር</Link> › {d.full_name}</div>
      <p className="muted small">ምዝገባ ቁ. <b dir="ltr">{a.reg_no ?? '—'}</b> · የቀረበው {formatEc(a.created_at)}። ሲጸድቅ አባሉ ይህንኑ ቁጥር ይይዛል፤ በምዝገባ ወቅት በፈጠረው ኮድም መግባት ይችላል። መረጃውን ያረጋግጡ፣ አስፈላጊ ከሆነ ያስተካክሉ እና “አጽድቅና አባል መዝግብ” ይጫኑ።</p>
      {a.status !== 'pending' ? <div className="alert error">ይህ ማመልከቻ ቀደም ብሎ ተወስኗል።</div> : (
        <>
          <MemberForm mode="approve" applicationId={a.id} initial={{ ...d, photo_url, depts: a.depts }} />
          <details className="card" style={{ marginTop: 16 }}>
            <summary className="btn sm danger">ውድቅ አድርግ</summary>
            <div style={{ marginTop: 10 }}>
              <MediaForm action={rejectApplication} submitLabel="ውድቅ አድርግ" card={false}>
                <input type="hidden" name="id" value={a.id} />
                <div className="field"><label htmlFor="reason">ምክንያት</label><input id="reason" name="reason" required minLength={3} /></div>
              </MediaForm>
            </div>
          </details>
        </>
      )}
    </>
  );
}
