import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireMember } from '@/lib/member-auth';
import { logoutMember } from '@/lib/actions/student-auth';
import { getStaff } from '@/lib/auth';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const staff = await getStaff();
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="spacer" />
        <nav>
          <Link href="/student">የእኔ ገጽ</Link>
          {staff && <Link href="/staff">የክፍል ገጾች</Link>}
        </nav>
        <span className="chip-user">{me.fullName}</span>
        <form action={logoutMember}>
          <button className="btn sm secondary">ውጣ</button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
