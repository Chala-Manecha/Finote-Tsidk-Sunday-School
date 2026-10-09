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
  const [{ data: s }, { data: open }, { data: rows }] = await Promise.all([
    supabase.from('site_settings').select('registration_open, registration_until').maybeSingle(),
    supabase.rpc('registration_is_open'),
    supabase.from('member_applications').select('id, reg_no, full_name, phone, status, reject_reason, member_id, created_at, decided_at')
      .eq('status', show in STATUS ? show : 'pending').order('created_at', { ascending: show === 'pending' }).limit(300),
  ]);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የሕዝብ ምዝገባ</h2>
      <MediaForm action={setRegistration} submitLabel="አስቀምጥ" resetOnSuccess={false}>
        <p style={{ marginTop: 0 }}>
          ሁኔታ፦ {open ? <span className="pill present">ክፍት ነው — በድረ-ገጹ ላይ “ይመዝገቡ” ይታያል</span> : <span className="pill">ዝግ ነው</span>}
        </p>
        <label className="check"><input type="checkbox" name="open" defaultChecked={s?.registration_open ?? false} /> ምዝገባውን ለሕዝብ ክፈት</label>
        <div className="field" style={{ maxWidth: 360 }}>
          <span className="label">እስከ (ዓ.ም፣ አማራጭ)</span>
          <EcDatePicker name="until" defaultIso={s?.registration_until ?? null} yearsBack={0} yearsForward={1} />
          <span className="hint">ቀን ካልተመረጠ እስኪዘጉት ድረስ ክፍት ይሆናል።</span>
        </div>
      </MediaForm>

      <div className="cat-tabs">
        {Object.entries(STATUS).map(([k, v]) => (
          <Link key={k} href={`/staff/hr/applications?show=${k}`} className={show === k ? 'active' : ''}>{v}</Link>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ምዝገባ ቁ.</th><th>ሙሉ ስም</th><th>ስልክ</th><th>የምዝገባ ቀን</th><th>{show === 'pending' ? '' : 'ውሳኔ'}</th></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="small" dir="ltr">{r.reg_no ?? '—'}</td>
                <td>{r.full_name}</td>
                <td dir="ltr">{r.phone ?? '—'}</td>
                <td className="small">{formatEc(r.created_at)}</td>
                <td>
                  {r.status === 'pending' && <Link className="btn sm" href={`/staff/hr/applications/${r.id}`}>ተመልከትና ወስን</Link>}
                  {r.status === 'approved' && r.member_id && <Link className="link" href={`/staff/members/${r.member_id}`}>አባሉን እይ</Link>}
                  {r.status === 'rejected' && <span className="small">{r.reject_reason}</span>}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={5} className="muted">ምንም የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
