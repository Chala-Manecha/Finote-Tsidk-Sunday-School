import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { PrintButton } from '@/components/print-button';
import { addFollowup } from '@/lib/actions/people';

type W = {
  member_id: string; full_name: string; reg_no: string; phone: string | null; telegram_username: string | null;
  last_seen: string | null; first_missed: string | null; days_absent: number; level: 'warning' | 'lost';
};
type F = { id: string; member_id: string; contacted_on: string; note: string };

const tgLink = (u: string) => `https://t.me/${u.replace(/^@/, '')}`;

function Table({ list, notes, dept }: { list: W[]; notes: F[]; dept: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>አባል</th><th>ስልክ / Telegram</th><th>መጨረሻ የታዩበት</th><th className="num">ቀናት</th><th>ክትትል</th></tr></thead>
        <tbody>
          {list.map((r) => {
            const mine = notes.filter((n) => n.member_id === r.member_id);
            return (
              <tr key={r.member_id}>
                <td>{r.full_name}<div className="small muted">{r.reg_no}</div></td>
                <td>
                  {r.phone && <a className="link" href={`tel:${r.phone}`} dir="ltr">{r.phone}</a>}
                  {r.telegram_username && <div><a className="link small" href={tgLink(r.telegram_username)} target="_blank" rel="noopener noreferrer">@{r.telegram_username.replace(/^@/, '')}</a></div>}
                </td>
                <td>{r.last_seen ? formatEc(r.last_seen) : 'ከተመዘገቡ ጀምሮ አልተገኙም'}</td>
                <td className="num"><b>{r.days_absent}</b></td>
                <td style={{ minWidth: 260 }}>
                  {mine.slice(0, 3).map((n) => <div key={n.id} className="small">{formatEc(n.contacted_on)} — {n.note}</div>)}
                  {dept === 'audit' && (
                    <details className="no-print">
                      <summary className="link small">+ ክትትል መዝግብ</summary>
                      <MediaForm action={addFollowup} submitLabel="መዝግብ" card={false}>
                        <input type="hidden" name="member_id" value={r.member_id} />
                        <EcDatePicker name="contacted_on" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={0} required />
                        <input name="note" placeholder="ማን ደወለ፣ ምን አሉ" required style={{ width: '100%', marginTop: 6 }} />
                      </MediaForm>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={5} className="muted">የለም።</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** ኦዲት: members absent from both መዝሙር and ኮርስ — 20 days warning, 30 days lost. */
export default async function LostMembers({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'audit' && dept !== 'hr') notFound();
  const supabase = await createClient();
  const [{ data }, { data: fu }] = await Promise.all([
    supabase.rpc('member_absence_watch'),
    supabase.from('lost_followups').select('id, member_id, contacted_on, note').order('contacted_on', { ascending: false }).limit(500),
  ]);
  const rows = (data ?? []) as W[];
  const notes = (fu ?? []) as F[];
  const lost = rows.filter((r) => r.level === 'lost');
  const warn = rows.filter((r) => r.level === 'warning');

  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የጠፉ አባላት ክትትል</h2>
        <PrintButton />
      </div>
      <p className="muted small">
        ከመዝሙር ጥናትም ከኮርስም ለ20 ቀን የቀሩ ማስጠንቀቂያ፣ ለ30 ቀን የቀሩ “የጠፉ” ይባላሉ። ቀናቱ የሚቆጠሩት ጥናት/ትምህርት በተካሄደባቸው ጊዜያት ብቻ ነው፤ አባሉ ሲመለስ በራሱ ይነሳል።
      </p>
      <div className="stat-cards">
        <div className="stat-card"><b>{lost.length}</b>የጠፉ (30+ ቀን)</div>
        <div className="stat-card"><b>{warn.length}</b>ማስጠንቀቂያ (20–29 ቀን)</div>
      </div>
      <h3 className="section">የጠፉ ({lost.length})</h3>
      <Table list={lost} notes={notes} dept={dept} />
      <h3 className="section">ማስጠንቀቂያ ({warn.length})</h3>
      <Table list={warn} notes={notes} dept={dept} />
    </>
  );
}
