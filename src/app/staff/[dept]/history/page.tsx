import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SONG_CATEGORIES, SONG_CATEGORY_LABEL } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { ActionButton } from '@/components/action-button';
import { saveHistory, deleteHistory } from '@/lib/actions/office';

type Item = { id: string; category: string; media_type: 'photo' | 'video'; media_path: string; caption: string | null; item_date: string | null };

function HistoryFields({ item }: { item?: Item }) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="form-grid">
        <div className="field">
          <label>ምድብ <span className="req">*</span></label>
          <select name="category" required defaultValue={item?.category ?? ''}>
            <option value="" disabled>ይምረጡ</option>
            {SONG_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>አይነት</label>
          <select name="media_type" defaultValue={item?.media_type ?? 'photo'}>
            <option value="photo">ፎቶ</option>
            <option value="video">ቪዲዮ</option>
          </select>
        </div>
        <div className="field">
          <span className="label">ቀን (ዓ.ም)</span>
          <EcDatePicker name="item_date" defaultIso={item?.item_date} yearsBack={30} yearsForward={0} />
        </div>
        <div className="field">
          <label>ፋይል {!item && <span className="req">*</span>}</label>
          <input name="media" type="file" accept="image/*,video/*" required={!item} />
          {item && <span className="hint">አዲስ ፋይል ካልመረጡ ነባሩ ይቆያል።</span>}
        </div>
      </div>
      <div className="field">
        <label>መግለጫ</label>
        <textarea name="caption" rows={3} defaultValue={item?.caption ?? ''} />
      </div>
    </>
  );
}

export default async function OfficeHistory({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('history_items')
    .select('id, category, media_type, media_path, caption, item_date')
    .order('item_date', { ascending: false, nullsFirst: false });
  const items = (data ?? []) as Item[];

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ታሪካችን</h2>
      <MediaForm action={saveHistory} fileField="media" folder="history" resize submitLabel="+ ጨምር">
        <HistoryFields />
      </MediaForm>
      <p className="muted small" style={{ marginTop: 12 }}>ቪዲዮ እስከ 50MB ድረስ።</p>
      <div className="song-list">
        {items.map((it) => {
          const url = mediaUrl(supabase, it.media_path)!;
          return (
            <details key={it.id} className="song-row">
              <summary>
                <span>{it.caption?.split('\n')[0] || (it.media_type === 'video' ? 'ቪዲዮ' : 'ፎቶ')}</span>
                <span className="song-cat">{SONG_CATEGORY_LABEL[it.category]}</span>
                <span className="small muted">{formatEc(it.item_date)}</span>
              </summary>
              <div className="song-body">
                {it.media_type === 'video'
                  ? <video src={url} controls preload="metadata" style={{ maxWidth: '100%' }} />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={url} alt="" style={{ maxWidth: '100%', borderRadius: 4 }} loading="lazy" />}
                {it.caption && <p style={{ whiteSpace: 'pre-wrap' }}>{it.caption}</p>}
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <details>
                    <summary className="btn sm secondary">አርም</summary>
                    <div style={{ marginTop: 8 }}>
                      <MediaForm action={saveHistory} fileField="media" folder="history" resize submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}>
                        <HistoryFields item={it} />
                      </MediaForm>
                    </div>
                  </details>
                  <ActionButton action={deleteHistory.bind(null, it.id)} label="አጥፋ" className="btn sm danger"
                    confirmText="ይህን ማጥፋት ይፈልጋሉ?" />
                </div>
              </div>
            </details>
          );
        })}
        {items.length === 0 && <p className="muted">እስካሁን ምንም የለም።</p>}
      </div>
    </>
  );
}
