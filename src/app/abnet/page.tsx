import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AbnetTable, type Abnet } from '@/components/education-views';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'አብነት' };

export default async function AbnetPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('abnet_sessions').select('id, subjects, days, times, teacher').order('created_at');
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">አብነት</h1>
        <AbnetTable rows={(data ?? []) as Abnet[]} />
        <PublicFooter />
      </main>
    </>
  );
}
