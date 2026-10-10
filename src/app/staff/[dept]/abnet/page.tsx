import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { AbnetFields, AbnetTable, type Abnet, ABNET_COLS } from '@/components/education-views';
import { saveAbnet } from '@/lib/actions/education';

export default async function EducationAbnet({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('abnet_sessions').select(ABNET_COLS).order('created_at');
  const rows = ((data ?? []) as Abnet[]).map((a) => ({ ...a, audio_url: mediaUrl(supabase, a.audio_path), file_url: mediaUrl(supabase, a.file_path) }));
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>አብነት (ይመልከቱ/ያደራጁ)</h2>
      <MediaForm action={saveAbnet} submitLabel="+ ጨምር" fileField={['audio', 'file']} folder="abnet"><AbnetFields /></MediaForm>
      <AbnetTable rows={rows} editable />
    </>
  );
}
