import { SONG_CATEGORY_LABEL } from '@/lib/constants';
import { ActionButton } from './action-button';
import { SongForm } from './song-form';
import { deleteSong, deleteWereb } from '@/lib/actions/songs';

export type SongItem = {
  id: string; title: string; body: string | null; category?: string;
  audio_path: string | null; audio_url: string | null;
};

/** Expandable list of መዝሙራት or ወረብ. `editable` adds edit/delete. */
export function SongList({
  items, kind, editable, showCategory,
}: {
  items: SongItem[];
  kind: 'song' | 'wereb';
  editable?: boolean;
  showCategory?: boolean;
}) {
  if (items.length === 0) return <p className="muted">እስካሁን ምንም የለም።</p>;
  return (
    <div className="song-list">
      {items.map((s) => (
        <details key={s.id} className="song-row">
          <summary>
            <span>{s.title}</span>
            {showCategory && s.category && <span className="song-cat">{SONG_CATEGORY_LABEL[s.category]}</span>}
            {s.audio_url && <span aria-label="ድምፅ አለው">🔊</span>}
          </summary>
          <div className="song-body">
            {s.audio_url && <audio controls preload="none" src={s.audio_url} style={{ width: '100%' }} />}
            {s.body && <p style={{ whiteSpace: 'pre-wrap' }}>{s.body}</p>}
            {editable && (
              <div className="btn-row no-print" style={{ marginTop: 10 }}>
                <details>
                  <summary className="btn sm secondary">አርም</summary>
                  <div className="card" style={{ marginTop: 8 }}>
                    <SongForm kind={kind} initial={s} existingAudioUrl={s.audio_url} />
                  </div>
                </details>
                <ActionButton
                  action={(kind === 'song' ? deleteSong : deleteWereb).bind(null, s.id)}
                  label="አጥፋ" className="btn sm danger" confirmText={`"${s.title}" ማጥፋት ይፈልጋሉ?`}
                />
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
