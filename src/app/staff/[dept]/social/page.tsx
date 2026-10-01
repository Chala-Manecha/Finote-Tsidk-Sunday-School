import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_PLATFORMS, type SocialLink } from '@/lib/site';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveSocialLink, deleteSocialLink } from '@/lib/actions/site';

function Fields({ l }: { l?: SocialLink }) {
  return (
    <>
      {l && <input type="hidden" name="id" value={l.id} />}
      <div className="form-grid">
        <div className="field">
          <label>መድረክ</label>
          <select name="platform" required defaultValue={l?.platform ?? ''}>
            <option value="" disabled>ይምረጡ</option>
            {Object.entries(SOCIAL_PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>ሊንክ</label><input name="url" dir="ltr" required defaultValue={l?.url ?? ''} placeholder="https://t.me/…" /></div>
        <div className="field"><label>ስም (አማራጭ)</label><input name="label" defaultValue={l?.label ?? ''} placeholder="ለምሳሌ፦ የቴሌግራም ቻናላችን" /></div>
        <div className="field"><label>ቅደም ተከተል</label><input name="sort" type="number" step={1} defaultValue={l?.sort ?? 0} /></div>
      </div>
    </>
  );
}

/** የውስጥ ግንኙነት: social media buttons shown at the bottom of the home page and in the footer. */
export default async function SocialLinks({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'internal_comm') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('social_links').select('id, platform, url, label, sort').order('sort').order('created_at');
  const rows = (data ?? []) as SocialLink[];
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ማኅበራዊ ሚዲያ</h2>
      <p className="muted small">እዚህ የሚጨመሩት ሊንኮች በመነሻ ገጹ ግርጌ እንደ አዝራር እና በገጹ መጨረሻ መስመር ላይ ይታያሉ።</p>
      <MediaForm action={saveSocialLink} submitLabel="+ ጨምር"><Fields /></MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>መድረክ</th><th>ሊንክ</th><th>ስም</th><th className="num">ቅደም</th><th /></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{SOCIAL_PLATFORMS[l.platform]}</td>
                <td dir="ltr"><a className="link" href={l.url} target="_blank" rel="noopener noreferrer">{l.url}</a></td>
                <td>{l.label ?? ''}</td>
                <td className="num">{l.sort}</td>
                <td>
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 300 }}>
                        <MediaForm action={saveSocialLink} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}><Fields l={l} /></MediaForm>
                      </div>
                    </details>
                    <ActionButton action={deleteSocialLink.bind(null, l.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን ሊንክ አልተጨመረም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
