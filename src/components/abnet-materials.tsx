import { MediaForm } from './media-form';
import { Modal } from './modal';
import { ActionButton } from './action-button';
import { formatEc } from '@/lib/ethiopian-calendar';
import { saveMaterial, deleteMaterial } from '@/lib/actions/education';

export type Material = {
  id: string; kind: 'audio' | 'video' | 'file'; title: string; description: string | null;
  file_path: string | null; url: string | null; created_at: string; file_url?: string | null;
};
export const MATERIAL_COLS = 'id, kind, title, description, file_path, url, created_at';
export const MATERIAL_KIND = { audio: { icon: '🎧', label: 'ድምፅ', plural: 'ድምፆች' }, video: { icon: '🎬', label: 'ቪዲዮ', plural: 'ቪዲዮዎች' }, file: { icon: '📄', label: 'ፋይል', plural: 'ፋይሎች' } } as const;
const ACCEPT = { audio: 'audio/*', video: 'video/*', file: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*' } as const;

/** A YouTube link → its embed address (other links are opened as they are). */
function youtubeEmbed(url: string | null) {
  if (!url) return null;
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i.exec(url);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function MaterialForm({ kind, m }: { kind: Material['kind']; m?: Material }) {
  return (
    <MediaForm action={saveMaterial} submitLabel={m ? 'አስቀምጥ' : `+ ${MATERIAL_KIND[kind].label} ጨምር`} card={false} resetOnSuccess={!m} fileField="file" folder="abnet">
      <input type="hidden" name="kind" value={kind} />
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="field"><label htmlFor={`mt-${m?.id ?? kind}`}>ስም</label><input id={`mt-${m?.id ?? kind}`} name="title" required minLength={2} maxLength={160} defaultValue={m?.title ?? ''} /></div>
      <div className="field"><label htmlFor={`md-${m?.id ?? kind}`}>መግለጫ</label><textarea id={`md-${m?.id ?? kind}`} name="description" rows={3} maxLength={2000} defaultValue={m?.description ?? ''} /></div>
      <div className="field">
        <label htmlFor={`mf-${m?.id ?? kind}`}>{MATERIAL_KIND[kind].label} ፋይል {m?.file_path ? '(ለመቀየር ብቻ)' : kind === 'video' ? '(ወይም ከታች ሊንክ)' : ''}</label>
        <input id={`mf-${m?.id ?? kind}`} name="file" type="file" accept={ACCEPT[kind]} />
      </div>
      {kind === 'video' && (
        <div className="field"><label htmlFor={`mu-${m?.id ?? kind}`}>የቪዲዮ ሊንክ (YouTube …)</label><input id={`mu-${m?.id ?? kind}`} name="url" type="url" dir="ltr" defaultValue={m?.url ?? ''} placeholder="https://youtu.be/…" /></div>
      )}
    </MediaForm>
  );
}

/** Materials grouped by kind; `editable` adds the add / edit / delete buttons (ትምህርት ክፍል). */
export function MaterialsView({ rows, editable }: { rows: Material[]; editable?: boolean }) {
  return (
    <div className="mat-groups">
      {(Object.keys(MATERIAL_KIND) as Material['kind'][]).map((k) => {
        const list = rows.filter((r) => r.kind === k);
        if (!editable && list.length === 0) return null;
        return (
          <section key={k} className="card mat-group">
            <div className="card-head">
              <b>{MATERIAL_KIND[k].icon} {MATERIAL_KIND[k].plural}</b><span className="count-badge">{list.length}</span>
              <span className="spacer" />
              {editable && <Modal label={`+ ${MATERIAL_KIND[k].label}`} title={`አዲስ ${MATERIAL_KIND[k].label}`} btnClass="btn sm green"><MaterialForm kind={k} /></Modal>}
            </div>
            {list.length === 0 ? <p className="muted small">እስካሁን የለም።</p> : (
              <ul className="mat-list">
                {list.map((m) => {
                  const yt = k === 'video' ? youtubeEmbed(m.url) : null;
                  return (
                    <li key={m.id}>
                      <div className="mat-head">
                        <b>{m.title}</b>
                        <span className="small muted">{formatEc(m.created_at.slice(0, 10))}</span>
                      </div>
                      {m.description && <p className="small mat-desc">{m.description}</p>}
                      {k === 'audio' && m.file_url && <audio controls preload="none" src={m.file_url} style={{ width: '100%' }} />}
                      {k === 'video' && (yt
                        ? <div className="mat-video"><iframe src={yt} title={m.title} loading="lazy" allowFullScreen /></div>
                        : m.file_url
                          ? <video controls preload="none" src={m.file_url} style={{ width: '100%', borderRadius: 10 }} />
                          : m.url && <a className="link" href={m.url} target="_blank" rel="noopener noreferrer">▶ ቪዲዮውን ክፈት</a>)}
                      {k === 'file' && m.file_url && <a className="btn sm secondary" href={m.file_url} target="_blank" rel="noopener noreferrer">📄 ክፈት / አውርድ</a>}
                      {editable && (
                        <div className="btn-row" style={{ marginTop: 6 }}>
                          <Modal label="አርም" title={`${MATERIAL_KIND[k].label} አርም`} btnClass="btn xs secondary"><MaterialForm kind={k} m={m} /></Modal>
                          <ActionButton action={deleteMaterial.bind(null, m.id)} label="አጥፋ" className="btn xs danger" confirmText={`“${m.title}” ይጥፋ?`} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
