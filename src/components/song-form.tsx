'use client';
import { useActionState, useState, startTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saveSong, saveWereb, type FormState } from '@/lib/actions/songs';
import { SONG_CATEGORIES } from '@/lib/constants';
import { AudioInput } from './audio-input';

type Initial = { id: string; title: string; body: string | null; category?: string; audio_path: string | null };

const MAX = 50 * 1024 * 1024;

async function uploadAudio(folder: 'songs' | 'wereb', blob: Blob): Promise<string> {
  if (blob.size > MAX) throw new Error('ፋይሉ ከ50MB በላይ ነው።');
  const ext = (blob instanceof File && blob.name.includes('.')) ? blob.name.split('.').pop() : (blob.type.split('/')[1] || 'webm').split(';')[0];
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from('media').upload(path, blob, { contentType: blob.type || undefined });
  if (error) throw new Error(`ድምፅ መጫን አልተቻለም፦ ${error.message}`);
  return path;
}

/** Add/edit a መዝሙር (kind="song") or ወረብ (kind="wereb"). */
export function SongForm({
  kind, initial, existingAudioUrl, defaultCategory,
}: {
  kind: 'song' | 'wereb';
  initial?: Initial;
  existingAudioUrl?: string | null;
  defaultCategory?: string;
}) {
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await (kind === 'song' ? saveSong : saveWereb)(prev, fd);
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  const [audio, setAudio] = useState<Blob | null>(null);
  const [keep, setKeep] = useState(!!initial?.audio_path);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sfx = initial?.id ?? 'new';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    fd.set('keep_audio', keep ? '1' : '0');
    if (audio) {
      try {
        setUploading(true);
        fd.set('audio_path', await uploadAudio(kind === 'song' ? 'songs' : 'wereb', audio));
      } catch (x) {
        setErr((x as Error).message);
        return;
      } finally {
        setUploading(false);
      }
    }
    startTransition(() => action(fd));
  }

  // After a successful add, the <form key> remount clears the inputs; clear the
  // picked audio too (adjusting state during render, per React docs).
  const [seenN, setSeenN] = useState(state.n);
  if (state.n !== seenN) {
    setSeenN(state.n);
    if (!initial) setAudio(null);
  }

  return (
    <form onSubmit={onSubmit} className={initial ? '' : 'card'} key={initial ? undefined : state.n}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`t-${sfx}`}>ርዕስ <span className="req">*</span></label>
          <input id={`t-${sfx}`} name="title" required defaultValue={initial?.title} />
        </div>
        {kind === 'song' && (
          <div className="field">
            <label htmlFor={`c-${sfx}`}>ምድብ <span className="req">*</span></label>
            <select id={`c-${sfx}`} name="category" required defaultValue={initial?.category ?? defaultCategory ?? ''}>
              <option value="" disabled>ይምረጡ</option>
              {SONG_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor={`b-${sfx}`}>ግጥም / ጽሑፍ</label>
        <textarea id={`b-${sfx}`} name="body" rows={6} defaultValue={initial?.body ?? ''} />
      </div>
      <AudioInput existingUrl={existingAudioUrl} onChange={(b, k) => { setAudio(b); setKeep(k); }} />
      <div className="btn-row">
        <button className="btn" disabled={pending || uploading}>
          {uploading ? 'ድምፅ በመጫን ላይ…' : pending ? '…' : initial ? 'ለውጥ አስቀምጥ' : kind === 'song' ? '+ መዝሙር ጨምር' : '+ ወረብ ጨምር'}
        </button>
        {(err || state.error) && <span className="alert error" style={{ margin: 0 }}>{err || state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
