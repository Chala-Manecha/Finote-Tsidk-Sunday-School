import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { setRegistration } from '@/lib/actions/applications';

const STATUS = { pending: 'በመጠባበቅ ላይ', approved: 'ጸድቋል', rejected: 'ተቀባይነት አላገኘም' } as const;

/** HR: open public self-registration for a while, then approve or reject what comes in. */
export default async function Applications({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ show?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const { show = 'pending' } = await searchParams;
  const supabase = await createClient();
  const count = (st: keyof typeof STATUS) =>
    supabase.from('member_applications').select('id', { count: 'exact', head: true }).eq('status', st).then((r) => r.count ?? 0);
  const [{ data: s }, { data: open }, { data: rows }, pending, approved, rejected] = await Promise.all([
    supabase.from('site_settings').select('registration_open, registration_until').maybeSingle(),
    supabase.rpc('registration_is_open'),
    (show === 'all'
      ? supabase.from('member_applications').select('id, reg_no, full_name, phone, status, reject_reason, member_id, created_at, decided_at').order('created_at', { ascending: false }).limit(500)
      : supabase.from('member_applications').select('id, reg_no, full_name, phone, status, reject_reason, member_id, created_at, decided_at')
      .eq('status', show in STATUS ? show : 'pending').order('created_at', { ascending: show === 'pending' }).limit(300)),
    count('pending'), count('approved'), count('rejected'),
  ]);
  const counts = { pending, approved, rejected };
  const total = pending + approved + rejected;

  return (
    <>
      <div className="head-row">
        <h2 className="section">ምዝገባና ተመዝጋቢዎች</h2>
        <div className="stat-cards" style={{ margin: 0 }}>
          <Link className={`stat-card ${show === 'all' ? 'on' : ''}`} href="/staff/hr/applications?show=all"><b>{total}</b>ጠቅላላ</Link>
          {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((k) => (
            <Link key={k} className={`stat-card ${show === k ? 'on' : ''}`} href={`/staff/hr/applications?show=${k}`}>
              <b style={show === k ? undefined : { color: k === 'pending' ? 'var(--gold)' : k === 'approved' ? 'var(--green)' : 'var(--danger)' }}>{counts[k]}</b>{STATUS[k]}
            </Link>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <details className="pop">
          <summary className="btn sm secondary">🌐 የሕዝብ ምዝገባ፦ {open ? 'ክፍት' : 'ዝግ'} ▾</summary>
          <div className="pop-body" style={{ insetInlineStart: 'auto', insetInlineEnd: 0 }}>
            <MediaForm action={setRegistration} submitLabel="አስቀምጥ" resetOnSuccess={false} card={false}>
              <label className="check"><input type="checkbox" name="open" defaultChecked={s?.registration_open ?? false} /> ምዝገባውን ለሕዝብ ክፈት</label>
              <div className="field">
                <span className="label">እስከ (ዓ.ም፣ አማራጭ)</span>
                <EcDatePicker name="until" defaultIso={s?.registration_until ?? null} yearsBack={0} yearsForward={1} />
                <span className="hint">ቀን ካልተመረጠ እስኪዘጉት ድረስ ክፍት ይሆናል።</span>
              </div>
            </MediaForm>
          </div>
        </details>
        <Link className="btn sm green" href="/staff/hr/register">+ አባል መዝግብ</Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ምዝገባ ቁ.</th><th>ሙሉ ስም</th><th>ስልክ</th><th>የምዝገባ ቀን</th>{show === 'all' && <th>ሁኔታ</th>}<th>{show === 'pending' ? '' : 'ውሳኔ'}</th></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="small" dir="ltr">{r.reg_no ?? '—'}</td>
                <td>{r.full_name}</td>
                <td dir="ltr">{r.phone ?? '—'}</td>
                <td className="small">{formatEc(r.created_at)}</td>
                {show === 'all' && <td><span className={`pill ${r.status === 'approved' ? 'present' : r.status === 'rejected' ? 'absent' : 'half'}`}>{STATUS[r.status as keyof typeof STATUS]}</span></td>}
                <td>
                  {r.status === 'pending' && <Link className="btn sm" href={`/staff/hr/applications/${r.id}`}>ተመልከትና ወስን</Link>}
                  {r.status === 'approved' && r.member_id && <Link className="link" href={`/staff/members/${r.member_id}`}>አባሉን እይ</Link>}
                  {r.status === 'rejected' && <span className="small">{r.reject_reason}</span>}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={6} className="muted">ምንም የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
