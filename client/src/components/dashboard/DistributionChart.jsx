import { classificationLabel } from "../../lib/classifications.js";
import StatusIcon from "../design/StatusIcon.jsx";

const SEGMENTS = [
  { key: "ACTIVE", className: "dist-active" },
  { key: "REQUIRING_ATTENTION", className: "dist-attention" },
  { key: "INACTIVE", className: "dist-inactive" },
  { key: "INSUFFICIENT_DATA", className: "dist-insufficient" },
];

export default function DistributionChart({ counts, showHeading = false }) {
  const total = Number(counts?.total) || 0;

  function legendLabel(segment) {
    const value = Number(counts?.[segment.key]) || 0;
    if (total <= 0) {
      return `${classificationLabel(segment.key)}: ${value}`;
    }
    const percent = Math.round((value / total) * 1000) / 10;
    return `${classificationLabel(segment.key)}: ${value} (${percent}%)`;
  }

  return (
    <figure className="distribution">
      {showHeading ? null : <figcaption>Classification distribution</figcaption>}
      <div className="distribution-bar" role="img" aria-label="Share of students in each classification">
        {total === 0 ? <div className="distribution-empty">No classified students yet</div> : null}
        {total > 0
          ? SEGMENTS.map((segment) => {
              const value = Number(counts[segment.key]) || 0;
              if (value <= 0) {
                return null;
              }
              return (
                <div
                  key={segment.key}
                  className={`distribution-segment ${segment.className}`}
                  style={{ flexGrow: value }}
                  title={`${classificationLabel(segment.key)}: ${value}`}
                />
              );
            })
          : null}
      </div>
      <ul className="distribution-legend">
        {SEGMENTS.map((segment) => (
          <li key={segment.key} className="distribution-legend-item">
            <span className={`legend-swatch ${segment.className}`} aria-hidden="true" />
            <span className={`legend-icon icon-${segment.key}`}>
              <StatusIcon status={segment.key} size={14} />
            </span>
            {legendLabel(segment)}
          </li>
        ))}
      </ul>
    </figure>
  );
}
