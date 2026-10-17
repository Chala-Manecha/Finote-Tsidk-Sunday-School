import { MediaForm } from './media-form';
import { Modal } from './modal';
import { ActionButton } from './action-button';
import { formatEc } from '@/lib/ethiopian-calendar';
import { saveMaterial, deleteMaterial } from '@/lib/actions/education';

export type Material = {
  id: string; kind: 'audio' | 'video' | 'file' | 'negs'; title: string; description: string | null; folder: string | null;
  file_path: string | null; url: string | null; created_at: string; file_url?: string | null;
};
export const MATERIAL_COLS = 'id, kind, title, description, folder, file_path, url, created_at';
export const MATERIAL_KIND = { audio: { icon: '🎧', label: 'ድምፅ', plural: 'ድምፆች' }, video: { icon: '🎬', label: 'ቪዲዮ', plural: 'ቪዲዮዎች' }, file: { icon: '📄', label: 'ፋይል (PDF …)', plural: 'ፋይሎች (PDF)' }, negs: { icon: '📜', label: 'ነግስ', plural: 'ነግስ' } } as const;
const DOCS = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*';
const ACCEPT = { audio: 'audio/*', video: 'video/*', file: DOCS, negs: `${DOCS},audio/*` } as const;
/** The tab order on the public page: ፋይሎች → ድምፆች → ቪዲዮዎች */
export const LESSON_KINDS: Material['kind'][] = ['file', 'audio', 'video'];

/** A YouTube link → its embed address (other links are opened as they are). */
function youtubeEmbed(url: string | null) {
  if (!url) return null;
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i.exec(url);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1` : null;
}

export function MaterialForm({ kind, m, folders = [] }: { kind: Material['kind']; m?: Material; folders?: string[] }) {
  return (
    <MediaForm action={saveMaterial} submitLabel={m ? 'አስቀምጥ' : `+ ${MATERIAL_KIND[kind].label} ጨምር`} card={false} resetOnSuccess={!m} fileField="file" folder="abnet">
      <input type="hidden" name="kind" value={kind} />
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="field"><label htmlFor={`mt-${m?.id ?? kind}`}>ስም</label><input id={`mt-${m?.id ?? kind}`} name="title" required minLength={2} maxLength={160} defaultValue={m?.title ?? ''} /></div>
      <div className="field"><label htmlFor={`md-${m?.id ?? kind}`}>መግለጫ</label><textarea id={`md-${m?.id ?? kind}`} name="description" rows={3} maxLength={2000} defaultValue={m?.description ?? ''} /></div>
      {kind === 'audio' && (
        <div className="field">
          <label htmlFor={`mo-${m?.id ?? kind}`}>ዋና ማህደር (ፎልደር)</label>
          <input id={`mo-${m?.id ?? kind}`} name="folder" maxLength={120} defaultValue={m?.folder ?? ''} list={`mo-list-${m?.id ?? kind}`} placeholder="ለምሳሌ፦ ቅኔ ቤት፣ ድጓ፣ ጾመ ድጓ …" />
          <datalist id={`mo-list-${m?.id ?? kind}`}>{folders.map((f) => <option key={f} value={f} />)}</datalist>
          <span className="small muted">አንድ አይነት ማህደር ያላቸው ድምፆች በአንድ ላይ ይቀመጣሉ።</span>
        </div>
      )}
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

function Item({ m, editable, folders }: { m: Material; editable?: boolean; folders: string[] }) {
  const k = m.kind;
  const yt = k === 'video' ? youtubeEmbed(m.url) : null;
  const isAudio = (m.file_path ?? '').match(/\.(mp3|m4a|ogg|wav|aac|opus|webm)$/i);
  return (
    <li>
      <div className="mat-head">
        <b>{m.title}</b>
        <span className="small muted">{formatEc(m.created_at.slice(0, 10))}</span>
      </div>
      {m.description && <p className="small mat-desc">{m.description}</p>}
      {(k === 'audio' || (k === 'negs' && isAudio)) && m.file_url && <audio controls preload="none" src={m.file_url} style={{ width: '100%' }} />}
      {k === 'video' && (yt
        ? <div className="mat-video"><iframe src={yt} title={m.title} loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
        : m.file_url
          ? <video controls preload="none" src={m.file_url} style={{ width: '100%', borderRadius: 10 }} />
          : m.url && <a className="link" href={m.url} target="_blank" rel="noopener noreferrer">▶ ቪዲዮውን ክፈት</a>)}
      {(k === 'file' || (k === 'negs' && !isAudio)) && m.file_url && <a className="btn sm secondary" href={m.file_url} target="_blank" rel="noopener noreferrer">📄 ክፈት / አውርድ</a>}
      {editable && (
        <div className="btn-row" style={{ marginTop: 6 }}>
          <Modal label="አርም" title={`${MATERIAL_KIND[k].label} አርም`} btnClass="btn xs secondary"><MaterialForm kind={k} m={m} folders={folders} /></Modal>
          <ActionButton action={deleteMaterial.bind(null, m.id)} label="አጥፋ" className="btn xs danger" confirmText={`“${m.title}” ይጥፋ?`} />
        </div>
      )}
    </li>
  );
}

/** Materials grouped by kind (audios also by their folder); `editable` adds the add / edit / delete buttons (ትምህርት ክፍል). */
export function MaterialsView({ rows, editable, kinds = LESSON_KINDS }: { rows: Material[]; editable?: boolean; kinds?: Material['kind'][] }) {
  const folders = [...new Set(rows.map((r) => r.folder).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b, 'am'));
  const shown = kinds.filter((k) => editable || rows.some((r) => r.kind === k));
  if (shown.length === 0) return <p className="muted">እስካሁን ምንም አልተጫነም።</p>;
  return (
    <div className="mat-groups">
      {shown.map((k) => {
        const list = rows.filter((r) => r.kind === k);
        const groups = k === 'audio'
          ? [...folders.map((f) => [f, list.filter((r) => r.folder === f)] as const), ['', list.filter((r) => !r.folder)] as const].filter(([, l]) => l.length)
          : [['', list] as const];
        return (
          <section key={k} className="card mat-group">
            <div className="card-head">
              <b>{MATERIAL_KIND[k].icon} {MATERIAL_KIND[k].plural}</b><span className="count-badge">{list.length}</span>
              <span className="spacer" />
              {editable && <Modal label={`+ ${MATERIAL_KIND[k].label}`} title={`አዲስ ${MATERIAL_KIND[k].label}`} btnClass="btn sm green"><MaterialForm kind={k} folders={folders} /></Modal>}
            </div>
            {list.length === 0 ? <p className="muted small">እስካሁን የለም።</p> : groups.map(([f, l]) => f ? (
              <details key={f} className="mat-folder" open={groups.length === 1}>
                <summary>📁 {f} <span className="count-badge">{l.length}</span></summary>
                <ul className="mat-list">{l.map((m) => <Item key={m.id} m={m} editable={editable} folders={folders} />)}</ul>
              </details>
            ) : (
              <ul key="_" className="mat-list">{l.map((m) => <Item key={m.id} m={m} editable={editable} folders={folders} />)}</ul>
            ))}
          </section>
        );
      })}
    </div>
  );
}
