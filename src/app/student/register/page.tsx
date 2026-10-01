import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public-header';
import { StudentRegisterForm } from '@/components/student-auth-forms';

export const metadata: Metadata = { title: 'የተማሪ ምዝገባ' };

export default function StudentRegister() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ለትምህርት ዘመኑ ይመዝገቡ</h1>
        <p className="muted">
          የሰንበት ትምህርት ቤቱ አባል ሆነው የተሰጠዎትን የመመዝገቢያ ቁጥር እና ሲመዘገቡ ያስገቡትን ስልክ ያስገቡ። ክፍልዎን ትምህርት ክፍል ይመድባል።
        </p>
        <StudentRegisterForm />
      </main>
    </>
  );
}
