'use client';
import { useActionState, useState, startTransition } from 'react';
import { uploadTo, resizeImage } from '@/lib/client/upload';

export type FormState = { error?: string; ok?: string };
type Action = (s: FormState, fd: FormData) => Promise<FormState>;

/**
 * Generic form that uploads its file input (name = `fileField`) to the
 * `media` bucket before calling the server action with `${fileField}_path`.
 * Fields are passed as children. Remounts (clears) after a successful add.
 */
export function MediaForm({
  action, fileField, folder, bucket = 'media', resize = false, submitLabel, card = true, resetOnSuccess = true, children,
}: {
  action: Action;
  fileField?: string;
  folder?: string;
  bucket?: string;
  resize?: boolean;
  submitLabel: string;
  card?: boolean;
  resetOnSuccess?: boolean;
  children: React.ReactNode;
}) {
  const [state, run, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      return { ...res, n: (prev.n ?? 0) + (res.ok ? 1 : 0) };
    },
    {},
  );
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    if (fileField && folder) {
      const f = fd.get(fileField);
      fd.delete(fileField);
      if (f instanceof File && f.size > 0) {
        try {
          setUploading(true);
          const blob = resize && f.type.startsWith('image/') ? await resizeImage(f) : f;
          fd.set(`${fileField}_path`, await uploadTo(bucket, folder, blob, f.name));
          fd.set(`${fileField}_name`, f.name);
        } catch (x) {
          setErr((x as Error).message);
          return;
        } finally {
          setUploading(false);
        }
      }
    }
    startTransition(() => run(fd));
  }

  return (
    <form onSubmit={onSubmit} className={card ? 'card' : ''} key={resetOnSuccess ? state.n : undefined}>
      {children}
      <div className="btn-row">
        <button className="btn" disabled={pending || uploading}>
          {uploading ? 'ፋይል በመጫን ላይ…' : pending ? '…' : submitLabel}
        </button>
        {(err || state.error) && <span className="alert error" style={{ margin: 0 }}>{err || state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
