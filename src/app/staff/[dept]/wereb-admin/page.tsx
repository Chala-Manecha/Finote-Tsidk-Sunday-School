import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWereb } from '@/lib/songs-data';
import { formatEc } from '@/lib/ethiopian-calendar';
import { SongForm } from '@/components/song-form';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-button';
import { deleteWereb } from '@/lib/actions/songs';

/** ትምህርት ክፍል → ወረብ አስተዳደር: the list of ወረብ (added date); add / open / edit in a pop-up. */
export default async function EducationWerebAdmin({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const { q: raw } = await searchParams;
  const q = raw?.trim();
  const supabase = await createClient();
  const items = (await fetchWereb(supabase))
    .filter((w) => !q || w.title.includes(q))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ወረብ አስተዳደር</h2>
        <span className="count-badge">{items.length}</span>
        <span className="spacer" />
        <form className="toolbar slim no-print" action="/staff/education/wereb-admin">
          <input name="q" type="search" defaultValue={q} placeholder="🔍 ርዕስ" aria-label="ፈልግ" style={{ width: 170 }} />
        </form>
        <Modal label="+ ወረብ ጨምር" title="አዲስ ወረብ" size="lg"><SongForm kind="wereb" /></Modal>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>ወረብ</th><th>የተጨመረበት</th><th>ድምፅ</th><th className="no-print" /></tr></thead>
          <tbody>
            {items.map((w, i) => (
              <tr key={w.id}>
                <td className="num">{i + 1}</td>
                <td><b>{w.title}</b>{w.body && <div className="small muted clamp-1">{w.body.split('\n')[0]}</div>}</td>
                <td className="small">{w.created_at ? formatEc(w.created_at.slice(0, 10)) : '—'}</td>
                <td>{w.audio_url ? <span className="pill present">🔊 አለው</span> : <span className="small muted">—</span>}</td>
                <td className="no-print">
                  <div className="btn-row">
                    <Modal label="ክፈት / አርም" title={w.title} btnClass="btn xs secondary" size="lg">
                      {w.audio_url && <audio controls preload="none" src={w.audio_url} style={{ width: '100%', marginBottom: 10 }} />}
                      <SongForm kind="wereb" initial={w} existingAudioUrl={w.audio_url} />
                    </Modal>
                    <ActionButton action={deleteWereb.bind(null, w.id)} label="አጥፋ" className="btn xs danger" confirmText={`"${w.title}" ማጥፋት ይፈልጋሉ?`} />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="muted">{q ? 'አልተገኘም።' : 'እስካሁን ወረብ የለም — “+ ወረብ ጨምር” ይጫኑ።'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
