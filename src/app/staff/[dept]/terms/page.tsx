import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { termLabel, type Term } from '@/lib/periods';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { saveTerm, setActiveTerm, deleteTerm } from '@/lib/actions/office';

export default async function Terms({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('leadership_terms').select('*').order('starts_on', { ascending: false });
  const terms = (data ?? []) as Term[];
  const active = terms.find((t) => t.is_active);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የአመራር ቡድን (ዘመን)</h2>
      <p className="muted small">
        ለሰንበት ትምህርት ቤቱ በአንድ ዘመን አንድ የአመራር ቡድን ብቻ ይኖራል። አዲስ የሚመዘገቡ መረጃዎች (አባላት፣ ክትትል፣ ገንዘብ፣ ቀጠሮ…) በንቁው ቡድን ስም በራሳቸው ይመዘገባሉ፤ ሪፖርቶች “የቡድን ዘመን” በሚለው ሊጣሩ ይችላሉ።
      </p>
      <div className="stat-cards">
        <div className="stat-card"><b>{active ? termLabel(active) : '—'}</b>ንቁ ቡድን</div>
      </div>
      <MediaForm action={saveTerm} submitLabel="+ ቡድን መዝግብ">
        <div className="form-grid">
          <div className="field"><label>የቡድኑ ስም</label><input name="name" required placeholder="ለምሳሌ፦ አትናቴዎስ" /></div>
          <div className="field"><label>የቡድን ቁጥር</label><input name="team_no" type="number" min={1} step={1} placeholder="11" /></div>
          <div className="field"><span className="label">የጀመረበት (ዓ.ም)</span><EcDatePicker name="starts_on" defaultIso={todayIsoAddis()} yearsBack={5} yearsForward={1} required /></div>
          <div className="field"><span className="label">የሚያበቃበት (ዓ.ም፣ ካለ)</span><EcDatePicker name="ends_on" yearsBack={5} yearsForward={5} /></div>
        </div>
      </MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ቡድን</th><th>ከ</th><th>እስከ</th><th>ሁኔታ</th><th /></tr></thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td>{termLabel(t)}</td>
                <td>{t.starts_on ? formatEc(t.starts_on) : '—'}</td>
                <td>{t.ends_on ? formatEc(t.ends_on) : '—'}</td>
                <td>{t.is_active ? <span className="pill present">ንቁ</span> : <span className="pill">ያለፈ/ያልጀመረ</span>}</td>
                <td>
                  <div className="btn-row">
                    {!t.is_active && <ActionButton action={setActiveTerm.bind(null, t.id)} label="ንቁ አድርግ" className="btn sm green" confirmText={`${termLabel(t)} ንቁ ቡድን ይሁን?`} />}
                    <ActionButton action={deleteTerm.bind(null, t.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ? የተመዘገቡ መረጃዎች አይጠፉም፤ የቡድን መለያቸው ብቻ ይነሳል።" />
                  </div>
                </td>
              </tr>
            ))}
            {terms.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን ቡድን አልተመዘገበም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
