import { Brand } from '@/components/brand';
import { RoleSwitch } from '@/components/role-switch';
import { requireMember } from '@/lib/member-auth';
import { logoutMember } from '@/lib/actions/student-auth';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="spacer" />
        <RoleSwitch />
        <span className="chip-user">{me.fullName}</span>
        <form action={logoutMember}>
          <button className="btn sm secondary">ውጣ</button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
