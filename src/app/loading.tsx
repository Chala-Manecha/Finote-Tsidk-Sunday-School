/** Shown while a page loads, so the footer never jumps up into an empty screen. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      <span className="small muted">በመጫን ላይ…</span>
    </div>
  );
}
