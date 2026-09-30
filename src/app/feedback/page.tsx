import type { Metadata } from 'next';
import { FeedbackForm } from '@/components/feedback-form';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'አስተያየት ለመስጠት' };
export const revalidate = 86400; // keeps the anniversary year in the header current

export default function FeedbackPage() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">አስተያየት ለመስጠት</h1>
        <p className="muted small">አስተያየት መስጠት የሚችሉት የተመዘገቡ አባላት ብቻ ናቸው። ሲመዘገቡ የተሰጠዎትን የመመዝገቢያ ቁጥር (ፍጽ-…) እና Telegram username ያስገቡ።</p>
        <FeedbackForm />
        <PublicFooter />
      </main>
    </>
  );
}
