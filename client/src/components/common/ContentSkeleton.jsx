import { useDelayedLoading } from "../../hooks/useDelayedLoading.js";

function TableSkeleton({ rows, columns }) {
  return (
    <div className="content-skeleton content-skeleton--table" style={{ "--skeleton-columns": columns }}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="skeleton-row" key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <span className="skeleton-cell" key={columnIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ rows }) {
  return (
    <div className="content-skeleton content-skeleton--cards">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton-bar skeleton-bar-lg" />
          <span className="skeleton-bar" />
          <span className="skeleton-bar skeleton-bar-short" />
        </div>
      ))}
    </div>
  );
}

function LineSkeleton({ rows }) {
  return (
    <div className="content-skeleton content-skeleton--lines">
      {Array.from({ length: rows }, (_, index) => (
        <span className="skeleton-bar" key={index} />
      ))}
    </div>
  );
}

export default function ContentSkeleton({
  loading,
  variant = "table",
  rows = 5,
  columns = 5,
  label = "Loading content…",
  delay = 180,
  className = "",
}) {
  const { mounted, visible } = useDelayedLoading(loading, { delay });

  if (!mounted) {
    return null;
  }

  const classes = ["content-skeleton-wrap", visible ? "is-visible" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {variant === "cards" ? <CardSkeleton rows={rows} /> : null}
      {variant === "lines" ? <LineSkeleton rows={rows} /> : null}
      {variant === "table" ? <TableSkeleton rows={rows} columns={columns} /> : null}
    </div>
  );
}
