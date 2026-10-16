'use client';
import { Modal } from './modal';
import { MediaForm } from './media-form';
import type { FormState } from './media-form';

/** A button that opens a small centred form; it closes itself once the save succeeds. */
export function PopForm({ label, action, submitLabel, title, children }: {
  label: string; action: (s: FormState, fd: FormData) => Promise<FormState>; submitLabel: string; title?: string; children: React.ReactNode;
}) {
  return (
    <Modal label={label} title={title ?? label.replace(/^[+⚙↩✎]\s*/, '')} size="sm" btnClass="btn sm green">
      <MediaForm action={action} submitLabel={submitLabel} card={false}>{children}</MediaForm>
    </Modal>
  );
}
