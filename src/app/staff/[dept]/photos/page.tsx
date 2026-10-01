import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { addPhoto, deletePhoto } from '@/lib/actions/office';

export default async function OfficePhotos({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'internal_comm') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('event_photos').select('id, caption, image_path').order('created_at', { ascending: false });

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ዝግጅት ፎቶዎች</h2>
      <p className="muted small">እነዚህ ፎቶዎች በመነሻ ገጹ &quot;የክፍል ዝግጅቶች&quot; ላይ ይሽከረከራሉ።</p>
      <MediaForm action={addPhoto} fileField="image" folder="photos" resize submitLabel="+ ፎቶ ጨምር">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="image">ፎቶ <span className="req">*</span></label>
            <input id="image" name="image" type="file" accept="image/*" required />
          </div>
          <div className="field">
            <label htmlFor="caption">መግለጫ</label>
            <input id="caption" name="caption" />
          </div>
        </div>
      </MediaForm>
      <div className="photo-grid" style={{ marginTop: 16 }}>
        {(data ?? []).map((p) => (
          <figure key={p.id} className="photo-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(supabase, p.image_path)!} alt={p.caption ?? ''} loading="lazy" />
            <figcaption>
              <span>{p.caption}</span>
              <ActionButton action={deletePhoto.bind(null, p.id)} label="አጥፋ" className="btn sm danger"
                confirmText="ይህን ፎቶ ማጥፋት ይፈልጋሉ?" />
            </figcaption>
          </figure>
        ))}
        {data?.length === 0 && <p className="muted">እስካሁን ፎቶ የለም።</p>}
      </div>
    </>
  );
}
