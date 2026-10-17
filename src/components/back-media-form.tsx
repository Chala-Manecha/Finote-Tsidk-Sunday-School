'use client';
import { useRouter } from 'next/navigation';
import { MediaForm } from './media-form';

/** A MediaForm that goes back to `back` (e.g. the list of days) once saved — the saved entry then shows read-only. */
export function BackMediaForm({ back, ...props }: Omit<React.ComponentProps<typeof MediaForm>, 'onSaved'> & { back: string }) {
  const router = useRouter();
  return <MediaForm {...props} onSaved={() => router.push(back, { scroll: false })} />;
}
