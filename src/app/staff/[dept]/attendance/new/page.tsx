import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { SESSION_TYPES, sessionTypesForDept, type SessionType } from '@/lib/constants';
import { NewSessionRoster } from './roster';

export default async function NewSession({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ type?: string; date?: string; time?: string }>;
}) {
  const { dept } = await params;
  const { type, date, time } = await searchParams;
  const types = sessionTypesForDept(dept);
  if (!type || !types.includes(type as SessionType)) notFound();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <div className="alert error">ቀን አልተመረጠም። <Link className="link" href={`/staff/${dept}/attendance`}>ተመለስ</Link></div>;
  }

  const supabase = await createClient();
  const { data: members } = await supabase
    .from('members')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name');

  return (
    <>
      <div className="crumb"><Link href={`/staff/${dept}/attendance`}>ክትትል</Link> › አዲስ</div>
      <h2 className="section" style={{ marginTop: 0 }}>
        {SESSION_TYPES[type as SessionType].label} — {formatEc(date, { weekday: true })}
        {time ? ` · ${time}` : ''}
      </h2>
      <p className="muted small">ሁሉም የተመዘገቡ አባላት ተዘርዝረዋል፤ ያልተመረጠ ሁሉ &quot;ቀሪ&quot; ሆኖ ይቀመጣል።</p>
      <NewSessionRoster
        members={members ?? []}
        type={type as SessionType}
        date={date}
        time={time || null}
      />
    </>
  );
}
