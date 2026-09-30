import Link from 'next/link';
import { SCHOOL_NAME } from '@/lib/constants';

// Public site placeholder — the public pages (ኮርስ, ዜማ, ታሪካችን …) come in a later phase.
export default function Home() {
  return (
    <>
      <header className="topbar">
        <span className="brand">{SCHOOL_NAME}</span>
        <span className="spacer" />
        <nav>
          <Link href="/staff">ሁሉም ክፍሎች (9)</Link>
        </nav>
      </header>
      <main className="page">
        <div className="card" style={{ marginTop: 30 }}>
          <h1 className="title">እንኳን ወደ {SCHOOL_NAME} በሰላም መጡ።</h1>
          <p>ለመመዝገብ ወደ ቢሮ ቁጥር 9 በአካል ይሂዱ።</p>
          <p className="muted small">
            አቃቂ ቃሊቲ, ወረዳ-1, ደብረ ጽጌ ቅዱስ ሩፋኤል ቤተክርስቲያን, ኢትዮጵያ
          </p>
        </div>
      </main>
    </>
  );
}
