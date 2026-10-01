import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HOME_SECTIONS, normaliseSections } from '@/lib/site';
import { MediaForm } from '@/components/media-form';
import { saveHomeSettings } from '@/lib/actions/site';

/** የውስጥ ግንኙነት: what the public home page shows, and in which order. */
export default async function HomePageSettings({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'internal_comm') notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from('site_settings')
    .select('welcome_title, welcome_text, announcement, announcement_active, marquee_seconds, sections').maybeSingle();
  const sections = normaliseSections(s?.sections);

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የመነሻ ገጽ</h2>
        <Link className="link small" href="/" target="_blank">የመነሻ ገጹን እይ ↗</Link>
      </div>
      <MediaForm action={saveHomeSettings} submitLabel="አስቀምጥ" resetOnSuccess={false}>
        <div className="form-section">የማስታወቂያ መስመር (ከገጹ በላይ)</div>
        <div className="field"><label>ማስታወቂያ</label><input name="announcement" defaultValue={s?.announcement ?? ''} placeholder="ለምሳሌ፦ እሁድ ጠዋት 2:00 አጠቃላይ ጉባኤ አለ።" maxLength={200} /></div>
        <label className="check"><input type="checkbox" name="announcement_active" defaultChecked={s?.announcement_active ?? false} /> ማስታወቂያውን አሳይ</label>

        <div className="form-section">የመግቢያ ጽሑፍ</div>
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
