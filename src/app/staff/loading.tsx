/** Inside the staff pages (the top bar stays) while the next page loads. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      <span className="small muted">በመጫን ላይ…</span>
    </div>
  );
}
