import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fmtTime, formatEc } from '@/lib/ethiopian-calendar';
import { SESSION_TYPES, sessionTypesForDept, type SessionType } from '@/lib/constants';
import { NewSessionRoster } from './roster';

export default async function NewSession({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ type?: string; date?: string; time?: string; title?: string; mode?: string; platform?: string; platform_other?: string; link?: string }>;
}) {
  const { dept } = await params;
  const { type, date, time, title: rawTitle, mode, platform: p0, platform_other, link } = await searchParams;
  const platform = p0 === 'other' ? (platform_other ?? '').trim() || 'other' : p0;
  const delivery = { mode: mode === 'online' ? 'online' : 'physical', platform: mode === 'online' ? platform ?? null : null, link: mode === 'online' ? link ?? null : null };
  const title = (rawTitle ?? '').trim().slice(0, 160);
  const types = sessionTypesForDept(dept);
  if (!type || !types.includes(type as SessionType)) notFound();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <div className="alert error">ቀን አልተመረጠም። <Link className="link" href={`/staff/${dept}/attendance`}>ተመለስ</Link></div>;
  }

  const supabase = await createClient();
  // ስብሰባ: every active member · መዝሙር / ወረብ / አብነት: only those the department added (ተሳታፊዎች)
  const program = type === 'abnet' ? 'abnet' : type === 'mezmur' || type === 'wereb' ? 'mezmur' : null;
  const { data: members } = program
    ? await supabase.from('members').select('id, full_name, member_programs!inner(program, status)')
        .eq('is_active', true).eq('member_programs.program', program).eq('member_programs.status', 'active').order('full_name')
    : await supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name');

  return (
    <>
      <div className="crumb"><Link href={`/staff/${dept}/attendance`}>ክትትል</Link> › አዲስ</div>
      <h2 className="section" style={{ marginTop: 0 }}>
        {title ? `${title} · ` : ''}{SESSION_TYPES[type as SessionType].label} — {formatEc(date, { weekday: true })}
        {time ? ` · ${fmtTime(time)}` : ''}
      </h2>
      <p className="muted small">
        {program === 'abnet' ? <>“አብነት”ን የመረጡ ዲያቆናት ብቻ ተዘርዝረዋል (<Link className="link" href="/staff/education/abnet?v=students">ዲያቆናት</Link>)፤</>
          : program ? <>“መዝሙርና ወረብ”ን የመረጡ ብቻ ተዘርዝረዋል (<Link className="link" href={`/staff/${dept}/participants`}>ተማሪዎች</Link>)፤</> : 'ሁሉም ንቁ አባላት ተዘርዝረዋል፤'} ያልተመረጠ ሁሉ &quot;ቀሪ&quot; ሆኖ ይቀመጣል።
      </p>
      <NewSessionRoster
        members={(members ?? []).map((m) => ({ id: m.id, full_name: m.full_name }))}
        type={type as SessionType}
        date={date}
        time={time || null}
        title={title || null}
        delivery={delivery}
      />
    </>
  );
}
