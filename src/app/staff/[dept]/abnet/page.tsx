import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MediaForm } from '@/components/media-form';
import { AbnetFields, AbnetTable, type Abnet } from '@/components/education-views';
import { saveAbnet } from '@/lib/actions/education';

export default async function EducationAbnet({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('abnet_sessions').select('id, subjects, days, times, teacher').order('created_at');
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>አብነት (ይመልከቱ/ያደራጁ)</h2>
      <MediaForm action={saveAbnet} submitLabel="+ ጨምር"><AbnetFields /></MediaForm>
      <AbnetTable rows={(data ?? []) as Abnet[]} editable />
    </>
  );
}
