import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWereb } from '@/lib/songs-data';
import { SongForm } from '@/components/song-form';
import { SongList } from '@/components/song-list';

export default async function EducationWerebAdmin({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const items = await fetchWereb(supabase);
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ወረብ አስተዳደር</h2>
      <SongForm kind="wereb" />
      <h3 className="section">ወረቦች ({items.length})</h3>
      <SongList items={items} kind="wereb" editable />
    </>
  );
}
