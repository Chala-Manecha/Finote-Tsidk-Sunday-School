import { SONG_CATEGORY_LABEL } from '@/lib/constants';
import { ActionButton } from './action-button';
import { SongForm } from './song-form';
import { deleteSong, deleteWereb, deleteMahlet, deleteMahletAudio, saveMahletAudio } from '@/lib/actions/songs';
import { Modal } from './modal';
import { MediaForm } from './media-form';

export type SongItem = {
  id: string; title: string; body: string | null; category?: string;
  audio_path: string | null; audio_url: string | null; created_at?: string;
  /** ማሕሌት: several named audios */
  audios?: { id: string; title: string; url: string }[];
};

function MahletAudioForm({ mahletId }: { mahletId: string }) {
  return (
    <MediaForm action={saveMahletAudio} submitLabel="+ ድምፅ ጨምር" card={false} fileField="audio" folder="abnet">
      <input type="hidden" name="mahlet_id" value={mahletId} />
      <div className="field"><label htmlFor={`ma-t-${mahletId}`}>የድምፁ ስም</label><input id={`ma-t-${mahletId}`} name="title" required maxLength={160} placeholder="ለምሳሌ፦ ዚቅ፣ መልክእ፣ ሰላም …" /></div>
      <div className="field"><label htmlFor={`ma-f-${mahletId}`}>የድምፅ ፋይል</label><input id={`ma-f-${mahletId}`} name="audio" type="file" accept="audio/*" required /></div>
    </MediaForm>
  );
}

/** Expandable list of መዝሙራት or ወረብ. `editable` adds edit/delete. */
export function SongList({
  items, kind, editable, showCategory,
}: {
  items: SongItem[];
  kind: 'song' | 'wereb' | 'mahlet';
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
            {(s.audio_url || !!s.audios?.length) && <span aria-label="ድምፅ አለው">🔊{s.audios?.length ? ` ${s.audios.length + (s.audio_url ? 1 : 0)}` : ''}</span>}
          </summary>
          <div className="song-body">
            {s.audio_url && <audio controls preload="none" src={s.audio_url} style={{ width: '100%' }} />}
            {kind === 'mahlet' && (!!s.audios?.length || editable) && (
              <ul className="audio-list">
                {s.audios?.map((a) => (
                  <li key={a.id}>
                    <div className="audio-head">
                      <b>🎧 {a.title}</b>
                      {editable && <ActionButton action={deleteMahletAudio.bind(null, a.id)} label="አጥፋ" className="btn xs danger no-print" confirmText={`“${a.title}” ይጥፋ?`} />}
                    </div>
                    <audio controls preload="none" src={a.url} style={{ width: '100%' }} />
                  </li>
                ))}
                {editable && (
                  <li className="no-print"><Modal label="+ ድምፅ ጨምር" title={`${s.title} — አዲስ ድምፅ`} btnClass="btn xs green"><MahletAudioForm mahletId={s.id} /></Modal></li>
                )}
              </ul>
            )}
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
                  action={(kind === 'song' ? deleteSong : kind === 'mahlet' ? deleteMahlet : deleteWereb).bind(null, s.id)}
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
