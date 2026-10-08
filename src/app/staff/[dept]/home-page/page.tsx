import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HOME_SECTIONS, SITE_DEFAULTS, SITE_TEXT_COLUMNS, normaliseSections, type SiteSettings } from '@/lib/site';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { saveHomeSettings } from '@/lib/actions/site';

/** የውስጥ ግንኙነት: what the public home page shows, and in which order. */
export default async function HomePageSettings({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'internal_comm') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select(SITE_TEXT_COLUMNS).maybeSingle();
  const s = data as SiteSettings | null;
  const hero = mediaUrl(supabase, s?.hero_path);
  const sections = normaliseSections(s?.sections);

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የመነሻ ገጽ</h2>
        <Link className="link small" href="/" target="_blank">የመነሻ ገጹን እይ ↗</Link>
      </div>
      <MediaForm action={saveHomeSettings} submitLabel="አስቀምጥ" resetOnSuccess={false} fileField="hero" folder="photos" resize>
        <div className="form-section">ዋናው ምስል (ከላይ ያለው ትልቁ ፎቶ)</div>
        <div className="photo-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hero ? <img src={hero} alt="" style={{ width: 160, height: 90 }} /> : <div className="photo-placeholder" style={{ width: 160, height: 90 }}>ምስል የለም</div>}
          <div style={{ flex: 1 }}>
            <div className="field"><label>አዲስ ምስል (አግድም ፎቶ ይመረጣል)</label><input name="hero" type="file" accept="image/*" /></div>
            {hero && <label className="check"><input type="checkbox" name="remove_hero" /> ምስሉን አጥፋ (አርማው ብቻ ይታያል)</label>}
          </div>
        </div>
        <div className="field"><label>ከስሙ በታች ያለው መግለጫ</label><textarea name="hero_text" rows={4} defaultValue={s?.hero_text ?? ''} /></div>

        <div className="form-section">ተልዕኮ፣ ራዕይ እና እሴቶች</div>
        <div className="field"><label>ተልዕኮ</label><textarea name="mission" rows={3} defaultValue={s?.mission ?? ''} /></div>
        <div className="field"><label>ራዕይ</label><textarea name="vision" rows={3} defaultValue={s?.vision ?? ''} /></div>
        <div className="field"><label>እሴቶች</label><textarea name="core_values" rows={5} defaultValue={s?.core_values ?? ''} /><span className="hint">በእያንዳንዱ መስመር አንድ እሴት።</span></div>

        <div className="form-section">ስለ እኛ</div>
        <div className="field"><label>ርዕስ</label><input name="about_title" defaultValue={s?.about_title ?? ''} /></div>
        <div className="field"><label>የምሥረታ ታሪክ</label><textarea name="about_text" rows={5} defaultValue={s?.about_text ?? ''} /><span className="hint">ሙሉ ታሪኩ “ታሪካችን” ገጽ ላይ ይቀጥላል።</span></div>

        <div className="form-section">ያግኙን</div>
        <div className="form-grid">
          <div className="field"><label>ስልክ</label><input name="contact_phone" dir="ltr" defaultValue={s?.contact_phone ?? SITE_DEFAULTS.contact_phone} /></div>
          <div className="field"><label>ኢሜይል</label><input name="contact_email" type="email" dir="ltr" defaultValue={s?.contact_email ?? SITE_DEFAULTS.contact_email} /></div>
          <div className="field"><label>አድራሻ</label><input name="contact_address" defaultValue={s?.contact_address ?? SITE_DEFAULTS.contact_address} /></div>
          <div className="field"><label>ካርታ — Latitude</label><input name="map_lat" dir="ltr" inputMode="decimal" defaultValue={s?.map_lat ?? SITE_DEFAULTS.map_lat} /></div>
          <div className="field"><label>ካርታ — Longitude</label><input name="map_lng" dir="ltr" inputMode="decimal" defaultValue={s?.map_lng ?? SITE_DEFAULTS.map_lng} /></div>
        </div>

        <div className="form-section">የማስታወቂያ መስመር (ከገጹ በላይ)</div>
        <div className="field"><label>ማስታወቂያ</label><input name="announcement" defaultValue={s?.announcement ?? ''} placeholder="ለምሳሌ፦ እሁድ ጠዋት 2:00 አጠቃላይ ጉባኤ አለ።" maxLength={200} /></div>
        <label className="check"><input type="checkbox" name="announcement_active" defaultChecked={s?.announcement_active ?? false} /> ማስታወቂያውን አሳይ</label>

        <div className="form-section">እንኳን ደህና መጡ (የምዝገባ መረጃ)</div>
        <div className="field"><label>ርዕስ</label><input name="welcome_title" defaultValue={s?.welcome_title ?? ''} placeholder="እንኳን ወደ ፍኖተ ጽድቅ ሰንበት ትምህርት ቤት በሰላም መጡ።" /></div>
        <div className="field"><label>ጽሑፍ</label><textarea name="welcome_text" rows={3} defaultValue={s?.welcome_text ?? ''} placeholder="ለመመዝገብ ወደ ቢሮ ቁጥር 9 በአካል ይሂዱ።" /></div>

        <div className="form-section">የገጹ ክፍሎች — ቅደም ተከተልና ማሳያ</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ክፍል</th><th>ቅደም ተከተል</th><th>ይታይ</th></tr></thead>
            <tbody>
              {sections.map((x, i) => (
                <tr key={x.key}>
                  <td>{HOME_SECTIONS[x.key]}</td>
                  <td>
                    <select name={`order_${x.key}`} defaultValue={i + 1}>
                      {sections.map((_, n) => <option key={n} value={n + 1}>{n + 1}</option>)}
                    </select>
                  </td>
                  <td><input type="checkbox" name={`visible_${x.key}`} defaultChecked={x.visible} aria-label="ይታይ" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="form-section">ተንቀሳቃሽ ምስሎች</div>
        <div className="field">
          <label>አንድ ዙር የሚፈጀው ጊዜ (ሰከንድ)</label>
          <input name="marquee_seconds" type="number" min={10} max={180} step={1} defaultValue={s?.marquee_seconds ?? 40} />
          <span className="hint">ትንሽ ቁጥር = ፈጣን። ምስሎቹን “ተንቀሳቃሽ ምስሎች” ትር ላይ ይጨምሩ ወይም ያጥፉ።</span>
        </div>
      </MediaForm>
    </>
  );
}
