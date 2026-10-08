import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { getRoles, landingPath, ROLE_INFO } from '@/lib/roles';
import { getMember } from '@/lib/member-auth';
import { getStaff } from '@/lib/auth';
import { logout } from '@/app/login/actions';

export const metadata: Metadata = { title: 'እንደ ምን ይግቡ?' };

/** Shown after login only to people with more than one role. */
export default async function Choose() {
  const roles = await getRoles();
  const [member, staff] = await Promise.all([getMember(), getStaff()]);
  if (!member && !staff) redirect('/login');
  if (roles.length < 2) redirect(await landingPath());
  const name = member?.fullName ?? staff?.fullName;
  return (
    <>
      <header className="topbar"><Brand /></header>
      <main className="page" style={{ maxWidth: 760 }}>
        <h1 className="title" style={{ textAlign: 'center' }}>ሰላም፣ {name}</h1>
        <p className="muted" style={{ textAlign: 'center' }}>በየትኛው ሚና መግባት ይፈልጋሉ? በኋላ ከላይ ባለው ማውጫ መቀየር ይችላሉ።</p>
        <div className="role-cards">
          {roles.map((r) => (
            <Link key={r} href={ROLE_INFO[r].href} className="role-card">
              <span className="mvv-icon">{ROLE_INFO[r].icon}</span>
              <b>{ROLE_INFO[r].label}</b>
              <span className="small muted">{ROLE_INFO[r].text}</span>
            </Link>
          ))}
        </div>
        <form action={logout} style={{ textAlign: 'center', marginTop: 20 }}><button className="btn sm secondary">ውጣ</button></form>
      </main>
    </>
  );
}
