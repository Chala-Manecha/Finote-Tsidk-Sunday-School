import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public-header';
import { StudentRegisterForm } from '@/components/student-auth-forms';

export const metadata: Metadata = { title: 'መለያ ይፍጠሩ' };

export default function StudentRegister() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">መለያ ይፍጠሩ (ፒን)</h1>
        <p className="muted">
          ተማሪ፣ መምህር ወይም አመራር — ሁሉም አባላት በአንድ መግቢያ ይገባሉ። የተሰጠዎትን የመመዝገቢያ ቁጥር እና ሲመዘገቡ ያስገቡትን ስልክ ያስገቡ፤ ከዚያ ፒን ይፍጠሩ። ተማሪ ከሆኑ ክፍልዎን ትምህርት ክፍል ይመድባል።
        </p>
        <StudentRegisterForm />
      </main>
    </>
  );
}
