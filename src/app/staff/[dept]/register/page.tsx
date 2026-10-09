import { notFound } from 'next/navigation';
import { MemberForm } from '@/components/member-form';

export default async function RegisterPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>+ አባል መዝግብ</h2>
      <p className="muted small">በቢሮ ቁጥር 7 በአካል ለሚመጡ አዲስ አባላት። በቀጥታ ወደ አባላት ዝርዝር ይገባል።</p>
      <MemberForm />
    </>
  );
}
