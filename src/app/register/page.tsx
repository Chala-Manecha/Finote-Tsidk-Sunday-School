import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';
import { MemberForm } from '@/components/member-form';
import { createClient } from '@/lib/supabase/server';
import { SCHOOL_NAME } from '@/lib/constants';

export const metadata: Metadata = { title: 'የአባልነት ምዝገባ' };

/** Public self-registration — only while HR has it open; HR approves each one. */
export default async function Register() {
  const supabase = await createClient();
  const { data: open } = await supabase.rpc('registration_is_open');
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">የአባልነት ምዝገባ</h1>
        {open ? (
          <>
            <p className="muted">ወደ {SCHOOL_NAME} አባልነት ለመመዝገብ ቅጹን ይሙሉ። የሰው ሃብት አስተዳደር መረጃዎን አረጋግጦ ሲያጸድቀው የምዝገባ መለያ ቁጥርዎን ያገኛሉ። <span className="req">*</span> ያለባቸው መሞላት አለባቸው።</p>
            <MemberForm mode="public" />
          </>
        ) : (
          <div className="card">
            <p style={{ marginTop: 0 }}>የኦንላይን ምዝገባ ለጊዜው ዝግ ነው። ለመመዝገብ ቢሮ ቁጥር 7 በአካል ይምጡ።</p>
            <Link className="btn" href="/">ወደ ዋና ገጽ</Link>
          </div>
        )}
      </main>
    </>
  );
}
