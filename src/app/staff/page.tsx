import Link from 'next/link';
import { requireStaff, canAccess } from '@/lib/auth';
import { DEPARTMENTS } from '@/lib/constants';

export default async function StaffHub() {
  const staff = await requireStaff();
  return (
    <>
      <h1 className="title">ሰንበት ትምህርት ቤት — ክፍሎች</h1>
      <p className="muted small">እርስዎ የተመደቡባቸው ክፍሎች ብቻ ይከፈታሉ።</p>
      <div className="dept-grid" style={{ marginTop: 14 }}>
        {DEPARTMENTS.map((d) =>
          canAccess(staff, d.code) ? (
            <Link key={d.code} href={`/staff/${d.code}`} className="dept-card">
              <span>{d.name}</span>
              <span aria-hidden>‹</span>
            </Link>
          ) : (
            <div key={d.code} className="dept-card locked" title="ፈቃድ የለዎትም">
              <span>{d.name}</span>
              <span aria-hidden>🔒</span>
            </div>
          ),
        )}
      </div>
    </>
  );
}
