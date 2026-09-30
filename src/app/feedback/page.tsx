import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { FeedbackForm } from '@/components/feedback-form';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'አስተያየት ለመስጠት' };

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_member_names');
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">አስተያየት ለመስጠት</h1>
        <p className="muted small">አስተያየት መስጠት የሚችሉት የተመዘገቡ አባላት ብቻ ናቸው።</p>
        <FeedbackForm members={(data ?? []) as { id: string; full_name: string }[]} />
        <PublicFooter />
      </main>
    </>
  );
}
