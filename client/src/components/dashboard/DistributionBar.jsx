export default function DistributionBar({ counts, total, className = "", labelledBy }) {
  const denominator = total || counts?.total || 0;
  if (!denominator) {
    return <span className="muted comparison-empty">No results</span>;
  }

  const segments = [
    { key: "ACTIVE", className: "dist-active", value: counts.ACTIVE || 0 },
    { key: "REQUIRING_ATTENTION", className: "dist-attention", value: counts.REQUIRING_ATTENTION || 0 },
    { key: "INACTIVE", className: "dist-inactive", value: counts.INACTIVE || 0 },
    { key: "INSUFFICIENT_DATA", className: "dist-insufficient", value: counts.INSUFFICIENT_DATA || 0 },
  ];

  const label = `Active ${counts.ACTIVE || 0}, requiring attention ${counts.REQUIRING_ATTENTION || 0}, inactive ${
    counts.INACTIVE || 0
  }, insufficient ${counts.INSUFFICIENT_DATA || 0}`;

  return (
    <div
      className={`comparison-bar ${className}`.trim()}
      role="img"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
    >
      {segments.map((segment) => (
        <span
          key={segment.key}
          className={segment.className}
          style={{ flexGrow: segment.value || 0.0001, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}