import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FEEDBACK_STATUS, isDeptCode } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { ActionButton } from '@/components/action-button';
import { markFeedbackSeen } from '@/lib/actions/feedback';

type F = {
  id: string; message: string; contact: string | null; status: 'seen' | 'unseen'; created_at: string; seen_at: string | null;
  members: { full_name: string; telegram_username: string | null; phone: string | null } | null;
};

/** Telegram deep link: username first, then phone (Telegram opens chats by +phone). */
function telegramLink(f: F) {
  const c = f.contact ?? f.members?.telegram_username ?? f.members?.phone;
  if (!c) return null;
  const digits = c.replace(/[^\d+]/g, '');
  if (/^\+?\d{9,15}$/.test(digits)) {
    const intl = digits.startsWith('+') ? digits : digits.startsWith('0') ? `+251${digits.slice(1)}` : `+${digits}`;
    return `https://t.me/${intl}`;
  }
  return `https://t.me/${c.replace(/^@/, '')}`;
}

export default async function DeptFeedback({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!isDeptCode(dept)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from('feedback')
    .select('id, message, contact, status, created_at, seen_at, members(full_name, telegram_username, phone)')
    .eq('dept', dept)
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<F[]>();
  const rows = data ?? [];
  const unseen = rows.filter((r) => r.status === 'unseen').length;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>አስተያየቶች ({unseen} አልታየም)</h2>
      <p className="muted small">በTelegram መልስ ከሰጡ በኋላ &quot;ታይቷል&quot; ይበሉ።</p>
      <div className="song-list">
        {rows.map((f) => {
          const tg = telegramLink(f);
          return (
            <div key={f.id} className="card" style={{ borderTopColor: f.status === 'unseen' ? 'var(--maroon)' : 'var(--gold)' }}>
              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <b>{f.members?.full_name ?? '—'}</b>
                <span className="small muted">{formatEc(f.created_at)}</span>
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{f.message}</p>
              <div className="btn-row">
                <span className={`pill ${f.status === 'seen' ? 'present' : 'absent'}`}>{FEEDBACK_STATUS[f.status]}</span>
                {tg && <a className="btn sm secondary" href={tg} target="_blank" rel="noreferrer">Telegram ላይ መልስ</a>}
                {!tg && <span className="small muted">የመገናኛ መረጃ የለም</span>}
                {f.status === 'unseen' && (
                  <ActionButton action={markFeedbackSeen.bind(null, f.id)} label="ታይቷል" className="btn sm green" />
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="muted">እስካሁን አስተያየት የለም።</p>}
      </div>
    </>
  );
}
