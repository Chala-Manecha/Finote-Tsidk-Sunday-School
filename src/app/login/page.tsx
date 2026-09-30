import Link from 'next/link';
import { Brand } from '@/components/brand';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';
import { logout } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next = '/staff', reason } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedInButNotStaff = reason === 'no-staff' && !!data?.claims?.sub;

  return (
    <>
      <header className="topbar">
        <Brand />
      </header>
      <main className="page">
        <div className="card login-box">
          <h1 className="title">የሠራተኞች መግቢያ</h1>
          {signedInButNotStaff ? (
            <>
              <div className="alert error">
                ይህ መለያ ከማንኛውም ክፍል ጋር አልተያያዘም ወይም ታግዷል። እባክዎ ጽሕፈት ቤትን ያነጋግሩ።
              </div>
              <form action={logout}>
                <button className="btn secondary">ውጣ</button>
              </form>
            </>
          ) : (
            <LoginForm next={next} />
          )}
        </div>
      </main>
    </>
  );
}
