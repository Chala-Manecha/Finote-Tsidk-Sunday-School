'use client';
export function PrintButton() {
  return (
    <button type="button" className="btn sm secondary no-print" onClick={() => window.print()}>
      🖨 አትም
    </button>
  );
}
