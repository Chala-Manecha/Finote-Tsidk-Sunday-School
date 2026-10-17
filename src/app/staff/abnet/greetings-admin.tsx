import { createClient } from '@/lib/supabase/server';
import { bahireHasab } from '@/lib/bahire-hasab';
import { EC_MONTHS, todayEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { GREETING_COLS, HOLIDAY_DEFAULT, todaysGreetings, type DayGreeting } from '@/lib/greetings';
import { MediaForm } from '@/components/media-form';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-button';
import { deleteGreeting, saveGreeting, saveHolidayText } from '@/lib/actions/abnet';

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

function GreetingForm({ kind, g, feastKey, feastName }: { kind: DayGreeting['kind']; g?: DayGreeting; feastKey?: string; feastName?: string }) {
  const k = g?.id ?? feastKey ?? kind;
  return (
    <MediaForm action={saveGreeting} submitLabel={g ? 'አስቀምጥ' : '+ ጨምር'} card={false} resetOnSuccess={!g}>
      <input type="hidden" name="kind" value={kind} />
      {g && <input type="hidden" name="id" value={g.id} />}
      {feastKey && <input type="hidden" name="feast_key" value={feastKey} />}
      {kind !== 'feast' && (
        <div className="form-grid">
          {kind === 'yearly' && (
            <div className="field"><label htmlFor={`gm-${k}`}>ወር</label>
              <select id={`gm-${k}`} name="ec_month" defaultValue={g?.ec_month ?? 1} required>{EC_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            </div>
          )}
          <div className="field"><label htmlFor={`gd-${k}`}>{kind === 'monthly' ? 'በየወሩ ቀን' : 'ቀን'}</label>
            <select id={`gd-${k}`} name="ec_day" defaultValue={g?.ec_day ?? 1} required>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor={`gn-${k}`}>{kind === 'feast' ? `ስም (ባዶ ከሆነ “${feastName}”)` : kind === 'monthly' ? 'የመታሰቢያው ስም' : 'የበዓሉ ስም'}</label>
        <input id={`gn-${k}`} name="name" maxLength={120} defaultValue={g?.name ?? ''} required={kind === 'yearly'}
          placeholder={kind === 'monthly' ? 'ለምሳሌ፦ ቅድስት አርሴማ' : kind === 'yearly' ? 'ለምሳሌ፦ በዓለ ልደት (ገና)' : feastName} />
      </div>
      <div className="field">
        <label htmlFor={`gt-${k}`}>መልዕክት (ባዶ ከሆነ አጠቃላዩ የበዓል መልዕክት ይታያል)</label>
        <textarea id={`gt-${k}`} name="message" rows={3} maxLength={500} defaultValue={g?.message ?? ''}
          placeholder={kind === 'monthly' ? 'ለምሳሌ፦ ዛሬ እኮ ቅድስት አርሴማ ናት …' : 'እንኳን ለ{name} በሰላም አደረሳችሁ።'} />
        <span className="hint">{'{name}'} በስሙ ይተካል። አዲስ መስመር ለመጀመር Enter ይጫኑ።</span>
      </div>
      <label className="check"><input type="checkbox" name="active" defaultChecked={g?.active ?? true} /> በመነሻ ገጹ ላይ አሳይ</label>
    </MediaForm>
  );
}

/** አብነት → በዓላትና መልዕክት: what the home page says on feast days and monthly commemorations. */
export async function GreetingsAdmin() {
  const supabase = await createClient();
  const [{ data: rows }, { data: ab }, today] = await Promise.all([
    supabase.from('day_greetings').select(GREETING_COLS).order('ec_month').order('ec_day'),
    supabase.from('abnet_settings').select('holiday_text').maybeSingle(),
    todaysGreetings(supabase),
  ]);
  const all = (rows ?? []) as DayGreeting[];
  const tpl = ab?.holiday_text ?? HOLIDAY_DEFAULT;
  const b = bahireHasab(todayEc().year);
  const iso = todayIsoAddis();
  const yearly = all.filter((r) => r.kind === 'yearly');
  const monthly = all.filter((r) => r.kind === 'monthly').sort((x, y) => (x.ec_day ?? 0) - (y.ec_day ?? 0));
  const status = (g?: DayGreeting) => (g && !g.active ? <span className="pill absent">አይታይም</span> : <span className="pill present">ይታያል</span>);
  const msg = (g?: DayGreeting) => (g?.message ? <span className="small" style={{ whiteSpace: 'pre-line' }}>{g.message}</span> : <span className="small muted">አጠቃላዩ መልዕክት</span>);
  const actions = (g: DayGreeting, title: string) => (
    <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
      <Modal label="አርም" title={title} btnClass="btn xs secondary"><GreetingForm kind={g.kind} g={g} /></Modal>
      <ActionButton action={deleteGreeting.bind(null, g.id)} label="አጥፋ" className="btn xs danger" confirmText={`“${g.name ?? title}” ይጥፋ?`} />
    </div>
  );

  return (
    <div className="mat-groups">
      <section className="card">
        <div className="card-head"><b>👁 ዛሬ በመነሻ ገጹ ላይ</b><span className="count-badge">{today.length}</span></div>
        {today.length === 0 ? <p className="small muted" style={{ margin: 0 }}>ዛሬ ምንም መልዕክት የለም።</p> : (
          <ul className="greet-preview">{today.map((g, i) => <li key={i} className={g.kind}>{g.kind === 'birthday' ? '🎂' : '🕊'} <span>{g.text}</span></li>)}</ul>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>የልደት መልዕክቱን የውስጥ ግንኙነት ክፍል ያዘጋጃል።</p>
      </section>

      <section className="card">
        <div className="card-head"><b>✍️ አጠቃላዩ የበዓል መልዕክት</b></div>
        <MediaForm action={saveHolidayText} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
          <div className="field">
            <textarea name="holiday_text" rows={3} maxLength={500} defaultValue={tpl} aria-label="አጠቃላዩ የበዓል መልዕክት" />
            <span className="hint">{'{name}'} በበዓሉ ስም ይተካል — ለምሳሌ “እንኳን ለ{'{name}'} በሰላም አደረሳችሁ።” → “እንኳን ለትንሣኤ በሰላም አደረሳችሁ።”</span>
          </div>
        </MediaForm>
      </section>

      <section className="card">
        <div className="card-head"><b>🧮 ከባሕረ ሃሳብ — {b.year} ዓ.ም</b><span className="small muted">ቀኑ በራሱ ይሰላል</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>በዓል</th><th>ቀን</th><th>መልዕክት</th><th>ሁኔታ</th><th /></tr></thead>
            <tbody>
              {b.feasts.map((f) => {
                const g = all.find((r) => r.kind === 'feast' && r.feast_key === f.key);
                return (
                  <tr key={f.key} className={f.iso === iso ? 'row-next' : f.iso < iso ? 'row-past' : ''}>
                    <td><b>{g?.name || f.name}</b></td>
                    <td className="small">{f.label} · {f.weekday}</td>
                    <td>{msg(g)}</td>
                    <td>{status(g)}</td>
                    <td><Modal label="አርም" title={f.name} btnClass="btn xs secondary"><GreetingForm kind="feast" g={g} feastKey={f.key} feastName={f.name} /></Modal></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <b>📅 ዓመታዊ በዓላት</b><span className="count-badge">{yearly.length}</span><span className="spacer" />
          <Modal label="+ በዓል" title="አዲስ ዓመታዊ በዓል" btnClass="btn sm green"><GreetingForm kind="yearly" /></Modal>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>በየዓመቱ በተመሳሳይ ቀን የሚውሉ — መስቀል፣ ገና፣ ጥምቀት …</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>በዓል</th><th>ቀን</th><th>መልዕክት</th><th>ሁኔታ</th><th /></tr></thead>
            <tbody>
              {yearly.map((g) => (
                <tr key={g.id}><td><b>{g.name}</b></td><td className="small">{EC_MONTHS[(g.ec_month ?? 1) - 1]} {g.ec_day}</td><td>{msg(g)}</td><td>{status(g)}</td><td>{actions(g, g.name ?? '')}</td></tr>
              ))}
              {yearly.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <b>🔁 ወርኃዊ መታሰቢያዎች</b><span className="count-badge">{monthly.length}</span><span className="spacer" />
          <Modal label="+ መታሰቢያ" title="አዲስ ወርኃዊ መታሰቢያ" btnClass="btn sm green"><GreetingForm kind="monthly" /></Modal>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>በየወሩ በዚህ ቀን — ለምሳሌ 6 ቅድስት አርሴማ፣ 13 ቅዱስ ሩፋኤል።</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ቀን</th><th>ስም</th><th>መልዕክት</th><th>ሁኔታ</th><th /></tr></thead>
            <tbody>
              {monthly.map((g) => (
                <tr key={g.id}><td className="num"><b>{g.ec_day}</b></td><td>{g.name ?? '—'}</td><td>{msg(g)}</td><td>{status(g)}</td><td>{actions(g, `በየወሩ ${g.ec_day}`)}</td></tr>
              ))}
              {monthly.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን የለም።</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
