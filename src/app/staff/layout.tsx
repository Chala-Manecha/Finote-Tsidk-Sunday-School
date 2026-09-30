import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { SCHOOL_NAME } from '@/lib/constants';
import { logout } from '@/app/login/actions';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">{SCHOOL_NAME}</Link>
        <span className="spacer" />
        <nav>
          <Link href="/staff">ሁሉም ክፍሎች</Link>
          {staff.isAdmin && <Link href="/staff/admin/accounts">መለያዎች</Link>}
        </nav>
        <span className="chip-user">{staff.fullName}</span>
        <form action={logout}>
          <button className="btn sm secondary" style={{ color: '#F1E6C8', borderColor: '#C89B3C' }}>
            ውጣ
          </button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
