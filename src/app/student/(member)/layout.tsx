import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireMember } from '@/lib/member-auth';
import { logoutMember } from '@/lib/actions/student-auth';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="spacer" />
        <nav><Link href="/student">የእኔ ገጽ</Link></nav>
        <span className="chip-user">{me.fullName}</span>
        <form action={logoutMember}>
          <button className="btn sm secondary" style={{ color: '#F1E6C8', borderColor: '#C89B3C' }}>ውጣ</button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
