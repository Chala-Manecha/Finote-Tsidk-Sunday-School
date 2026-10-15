import { AREA_UNIT, PART_AREAS, PART_AREA_KEYS, bandOf, overall, type Bands, type PartArea, type PartCell } from '@/lib/participation';

/** One member's participation per area: bar, %, and the band HR set (በጣም ጥሩ / ጥሩ / ደካማ). */
export function ParticipationView({ data, bands, showAll = false, compact = false, declined = [] }: {
  data: Partial<Record<PartArea, PartCell>>; bands: Bands; showAll?: boolean; compact?: boolean;
  /** areas the member chose not to take part in — shown as “አልመረጡም” */
  declined?: PartArea[];
}) {
  const areas = PART_AREA_KEYS.filter((a) => showAll || data[a] || declined.includes(a));
  const all = overall(data);
  const allBand = bandOf(all, bands);
  if (areas.length === 0) return <p className="muted small">እስካሁን የተመዘገበ ተሳትፎ የለም።</p>;
  return (
    <div className={`part-view ${compact ? 'compact' : ''}`}>
      {areas.map((a) => {
        const c = data[a];
        const band = bandOf(c?.pct ?? null, bands);
        return (
          <div key={a} className="part-row">
            <span className="part-name">{PART_AREAS[a]}</span>
            <span className="part-bar" aria-hidden><i className={band ? `b-${band.key}` : ''} style={{ width: `${c?.pct ?? 0}%` }} /></span>
            <span className="part-pct">{c?.pct ?? '—'}{c?.pct !== null && c?.pct !== undefined ? '%' : ''}</span>
            <span className="part-band">{band ? <span className={`band b-${band.key}`}>{band.label}</span> : <span className="small muted">{declined.includes(a) && !c ? 'አልመረጡም' : 'አይሳተፍም'}</span>}</span>
            {!compact && (
              <span className="part-count small muted">
                {c ? `${fmt(c.attended)} / ${c.total} ${AREA_UNIT[a]}${c.pending ? ` · ${c.pending} ያልተረጋገጠ` : ''}` : ''}
              </span>
            )}
          </div>
        );
      })}
      {all !== null && (
        <div className="part-row part-total">
          <span className="part-name">አጠቃላይ</span>
          <span className="part-bar" aria-hidden><i className={allBand ? `b-${allBand.key}` : ''} style={{ width: `${all}%` }} /></span>
          <span className="part-pct">{all}%</span>
          <span className="part-band">{allBand && <span className={`band b-${allBand.key}`}>{allBand.label}</span>}</span>
          {!compact && <span className="part-count small muted">የሚሳተፍባቸው ዘርፎች አማካይ</span>}
        </div>
      )}
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function BandLegend({ bands }: { bands: Bands }) {
  return (
    <p className="small muted band-legend">
      <span className="band b-vg">በጣም ጥሩ</span> ≥ {bands.very_good}% ·{' '}
      <span className="band b-good">ጥሩ</span> {bands.good}–{bands.very_good - 1}% ·{' '}
      <span className="band b-poor">ደካማ</span> &lt; {bands.good}%
    </p>
  );
}
