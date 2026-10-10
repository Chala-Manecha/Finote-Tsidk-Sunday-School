'use client';
import { createClient } from '@/lib/supabase/client';

const MAX = 50 * 1024 * 1024;

/** Downscale a photo in the browser (keeps uploads small on mobile data). */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 800 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('resize failed'))), 'image/jpeg', quality),
  );
}

/** Upload to any bucket the signed-in user may write to; returns the storage path. */
export async function uploadTo(bucket: string, folder: string, blob: Blob, name = 'file'): Promise<string> {
  if (blob.size > MAX) throw new Error('ፋይሉ ከ50MB በላይ ነው።');
  const ext = (name.includes('.') ? name.split('.').pop() : (blob.type.split('/')[1] || 'bin').split(';')[0])!
    .toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${blob.type === 'image/jpeg' && ext !== 'jpg' ? 'jpg' : ext}`;
  const { error } = await createClient().storage.from(bucket).upload(path, blob, {
    contentType: blob.type || undefined,
  });
  if (error) throw new Error(`ፋይል መጫን አልተቻለም፦ ${error.message}`);
  return path;
}
