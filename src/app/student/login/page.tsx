import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public-header';
import { StudentLoginForm } from '@/components/student-auth-forms';

export const metadata: Metadata = { title: 'የተማሪ መግቢያ' };

export default function StudentLogin() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">የተማሪ / መምህር መግቢያ</h1>
        <p className="muted">ውጤትዎን ለማየት ወይም ለሚያስተምሩት ክፍል ውጤት ለመሙላት በመመዝገቢያ ቁጥርዎ እና በፒንዎ ይግቡ።</p>
        <StudentLoginForm />
      </main>
    </>
  );
}
