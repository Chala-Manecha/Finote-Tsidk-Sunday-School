import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PublicHeader } from '@/components/public-header';
import { StudentLoginForm } from '@/components/student-auth-forms';
import { getStaff } from '@/lib/auth';
import { getMember } from '@/lib/member-auth';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';
import { logout } from './actions';

export const metadata: Metadata = { title: 'መግቢያ' };

/** One login for everyone: registration number + PIN. What opens depends on the roles given by ጽሕፈት ቤት / ትምህርት ክፍል. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next = '', reason } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  if (signedIn && reason !== 'no-staff') {
    const [staff, member] = await Promise.all([getStaff(), getMember()]);
    if (staff || member) redirect(/^\/(staff|student)(\/|$)/.test(next) ? next : '/choose');
  }

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="login-box">
          <h1 className="title" style={{ textAlign: 'center' }}>መግቢያ</h1>
          {signedIn && reason === 'no-staff' ? (
            <div className="card">
              <div className="alert error" style={{ marginTop: 0 }}>
                የክፍል ገጾችን ለማየት ፈቃድ የለዎትም። ፈቃድ የሚሰጠው በጽሕፈት ቤት ነው።
              </div>
              <div className="btn-row">
                <Link className="btn" href="/student">ወደ የእኔ ገጽ</Link>
                <form action={logout}><button className="btn secondary">ውጣ</button></form>
              </div>
            </div>
          ) : (
            <>
              <p className="muted small" style={{ textAlign: 'center' }}>
                ተማሪዎች፣ መምህራን እና አመራሮች ሁሉም በመለያ ቁጥራቸው እና በ6 አሃዝ ፒናቸው ይገባሉ።
              </p>
              <StudentLoginForm next={next} />
              <details className="admin-login">
                <summary>የሲስተም አስተዳዳሪ መግቢያ (በተጠቃሚ ስም)</summary>
                <div className="card" style={{ marginTop: 10 }}><LoginForm next={next.startsWith('/staff') ? next : '/staff'} /></div>
              </details>
            </>
          )}
        </div>
      </main>
    </>
  );
}
