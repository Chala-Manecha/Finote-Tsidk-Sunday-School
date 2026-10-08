import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireStaff } from '@/lib/auth';
import { logout } from '@/app/login/actions';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="spacer" />
        <nav>
          <Link href="/staff">ሁሉም ክፍሎች</Link>
          {staff.isAdmin && <Link href="/staff/admin/accounts">መለያዎች</Link>}
        </nav>
        <span className="chip-user">{staff.fullName}</span>
        <form action={logout}>
          <button className="btn sm secondary">
            ውጣ
          </button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
