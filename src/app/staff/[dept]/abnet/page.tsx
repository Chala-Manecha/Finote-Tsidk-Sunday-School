import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { AbnetFields, AbnetTable, type Abnet, ABNET_COLS_LINK } from '@/components/education-views';
import { saveAbnet } from '@/lib/actions/education';
import { SegLinks } from '@/components/seg-links';

export default async function EducationAbnet({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('abnet_sessions').select(ABNET_COLS_LINK).order('created_at');
  const rows = ((data ?? []) as Abnet[]).map((a) => ({ ...a, audio_url: mediaUrl(supabase, a.audio_path), file_url: mediaUrl(supabase, a.file_path) }));
  return (
    <>
      <SegLinks current="list" items={[['list', '📖 የአብነት ትምህርቶች', '/staff/education/abnet'], ['att', '🧾 ክትትል መያዝ', '/staff/education/attendance']]} />
      <h2 className="section" style={{ marginTop: 0 }}>የአብነት ትምህርቶች</h2>
      <details className="card" style={{ marginBottom: 12 }}>
        <summary className="btn sm green" style={{ display: 'inline-block' }}>+ ትምህርት ጨምር</summary>
        <div style={{ marginTop: 10 }}><MediaForm action={saveAbnet} submitLabel="+ ጨምር" fileField={['audio', 'file']} folder="abnet" card={false}><AbnetFields /></MediaForm></div>
      </details>
      <AbnetTable rows={rows} editable />
    </>
  );
}
