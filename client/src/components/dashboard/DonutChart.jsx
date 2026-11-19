import { classificationLabel, INSUFFICIENT_DATA_HELP } from "../../lib/classifications.js";
import StatusIcon from "../design/StatusIcon.jsx";

const SEGMENTS = [
  { key: "ACTIVE", className: "dist-active", color: "var(--color-classification-active)" },
  { key: "REQUIRING_ATTENTION", className: "dist-attention", color: "var(--color-classification-attention)" },
  { key: "INACTIVE", className: "dist-inactive", color: "var(--color-classification-inactive)" },
  { key: "INSUFFICIENT_DATA", className: "dist-insufficient", color: "var(--color-classification-insufficient)" },
];

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polar(cx, cy, radius, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export default function DonutChart({
  counts,
  selectedClassification,
  onSelectClassification,
  onToggleClassification,
  subtitle,
  coverageNote,
  centerLabel = "classified",
}) {
  const total = Number(counts?.total) || 0;
  let angle = 0;
  const arcs = [];

  if (total > 0) {
    for (const segment of SEGMENTS) {
      const value = Number(counts[segment.key]) || 0;
      if (value <= 0) {
        continue;
      }
      const sweep = (value / total) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      arcs.push({ ...segment, value, startAngle, endAngle: sweep >= 359.99 ? startAngle + 359.99 : endAngle });
      angle += sweep;
    }
  }

  return (
    <figure className="donut-chart donut-chart-hero">
      <figcaption className="distribution-caption">
        <h2 className="panel-title">Classification distribution</h2>
        {subtitle ? <p className="panel-desc distribution-subtitle">{subtitle}</p> : null}
      </figcaption>
      <div className="distribution-hero-layout">
        <div className="donut-chart-stage">
          <svg viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label="Share of classified course enrolments by classification">
            <circle cx="100" cy="100" r="68" fill="none" stroke="var(--color-surface-subtle)" strokeWidth="28" />
            {total === 0
              ? null
              : arcs.map((arc) => (
                  <path
                    key={arc.key}
                    d={describeArc(100, 100, 68, arc.startAngle, arc.endAngle)}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="28"
                    strokeLinecap="butt"
                  >
                    <title>{`${classificationLabel(arc.key)}: ${arc.value}`}</title>
                  </path>
                ))}
            <text x="100" y="96" textAnchor="middle" className="donut-center-label">
              {total}
            </text>
            <text x="100" y="118" textAnchor="middle" className="donut-center-sub">
              {centerLabel}
            </text>
          </svg>
        </div>
        <ul className="distribution-legend distribution-legend-hero">
          {SEGMENTS.map((segment) => {
            const value = counts?.[segment.key] ?? 0;
            const pct = total ? Math.round((value / total) * 1000) / 10 : 0;
            const isSelected = selectedClassification === segment.key;
            return (
              <li key={segment.key} className="distribution-legend-item">
                {onSelectClassification ? (
                  <button
                    type="button"
                    className={`legend-filter-btn ${isSelected ? "is-selected" : ""}`}
                    onClick={() =>
                      onToggleClassification
                        ? onToggleClassification(segment.key)
                        : onSelectClassification(segment.key)
                    }
                    aria-pressed={isSelected}
                    title={segment.key === "INSUFFICIENT_DATA" ? INSUFFICIENT_DATA_HELP : undefined}
                  >
                    <span className={`legend-swatch ${segment.className}`} aria-hidden="true" />
                    <span className={`legend-icon icon-${segment.key}`}>
                      <StatusIcon status={segment.key} size={14} />
                    </span>
                    {classificationLabel(segment.key)}: {value} ({pct}%)
                    {segment.key === "INSUFFICIENT_DATA" ? (
                      <span className="legend-hint" title={INSUFFICIENT_DATA_HELP} aria-label={INSUFFICIENT_DATA_HELP}>
                        ?
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <span className="legend-filter-static">
                    <span className={`legend-swatch ${segment.className}`} aria-hidden="true" />
                    <span className={`legend-icon icon-${segment.key}`}>
                      <StatusIcon status={segment.key} size={14} />
                    </span>
                    {classificationLabel(segment.key)}: {value} ({pct}%)
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {coverageNote ? <p className="distribution-coverage-note">{coverageNote}</p> : null}
      {total === 0 ? <p className="panel-desc">No classification results for this period yet.</p> : null}
    </figure>
  );
}