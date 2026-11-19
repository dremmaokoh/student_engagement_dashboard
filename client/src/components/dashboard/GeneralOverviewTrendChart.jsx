import { useMemo, useState } from "react";
import { classificationLabel } from "../../lib/classifications.js";
import { formatRunTitle } from "../../lib/classificationRuns.js";

const SERIES = [
  { key: "ACTIVE", color: "var(--color-classification-active)" },
  { key: "REQUIRING_ATTENTION", color: "var(--color-classification-attention)" },
  { key: "INACTIVE", color: "var(--color-classification-inactive)" },
  { key: "INSUFFICIENT_DATA", color: "var(--color-classification-insufficient)" },
];

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const PAD = { top: 24, right: 20, bottom: 52, left: 48 };

function periodLabel(start, end) {
  if (!start || !end) {
    return "—";
  }
  return `${String(start).slice(0, 10)} – ${String(end).slice(0, 10)}`;
}

function shortPeriodAxis(start, end) {
  const s = String(start || "").slice(5, 10);
  const e = String(end || "").slice(5, 10);
  return s && e ? `${s}–${e}` : periodLabel(start, end);
}

function TrendSnapshot({ point, hoverSeries }) {
  const label = periodLabel(point.monitoringPeriodStart, point.monitoringPeriodEnd);
  return (
    <div className="classification-trend-run-tooltip classification-trend-snapshot">
      <p className="classification-trend-run-tooltip-title">
        Monitoring period {label}
        {point.isSelectedPeriod ? <span className="classification-trend-latest-badge"> Selected period</span> : null}
      </p>
      {point.incompleteCoverage ? (
        <p className="panel-desc classification-trend-coverage-warn">
          Partial coverage: {point.coursesIncluded} of {point.coursesInScope ?? point.coursesIncluded} courses have runs
          for this period.
        </p>
      ) : null}
      <dl className="classification-trend-run-tooltip-stats">
        {SERIES.map((series) => (
          <div key={series.key} className="classification-trend-run-tooltip-stat">
            <dt>
              <span className="classification-trend-legend-line" style={{ background: series.color }} aria-hidden="true" />
              {series.key === "ACTIVE"
                ? "Active student count"
                : series.key === "REQUIRING_ATTENTION"
                  ? "Requiring Attention count"
                  : series.key === "INACTIVE"
                    ? "Inactive student count"
                    : "Insufficient Data count"}
            </dt>
            <dd>{Number(point.counts?.[series.key]) || 0}</dd>
          </div>
        ))}
      </dl>
      {point.courseRuns?.length ? (
        <ul className="general-trend-run-list">
          {point.courseRuns.slice(0, 6).map((run) => (
            <li key={`${run.courseId}-${run.runId}`}>
              {formatRunTitle(run.courseCode, run.runName)}
              {run.generatedAt
                ? ` · ${new Date(run.generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                : ""}
            </li>
          ))}
          {point.courseRuns.length > 6 ? <li className="muted">+{point.courseRuns.length - 6} more courses</li> : null}
        </ul>
      ) : null}
      {hoverSeries ? (
        <p className="classification-trend-snapshot-hover muted">
          {classificationLabel(hoverSeries)}: {Number(point.counts?.[hoverSeries]) || 0} enrolments
        </p>
      ) : null}
    </div>
  );
}

export default function GeneralOverviewTrendChart({ trend, loading = false, coursesInScope = 0 }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const points = useMemo(() => trend?.points || [], [trend]);

  const geometry = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const innerW = CHART_WIDTH - PAD.left - PAD.right;
    const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
    let yMax = 0;
    for (const point of points) {
      for (const series of SERIES) {
        yMax = Math.max(yMax, Number(point.counts?.[series.key]) || 0);
      }
    }
    yMax = Math.max(yMax, 1);
    const xStep = innerW / (points.length - 1);
    const pointsBySeries = SERIES.map((series) => ({
      series,
      points: points.map((point, index) => {
        const value = Number(point.counts?.[series.key]) || 0;
        const x = PAD.left + xStep * index;
        const y = PAD.top + innerH - (value / yMax) * innerH;
        return { x, y, value, index };
      }),
    }));
    const yTicks = [0, Math.ceil(yMax / 2), yMax];
    return { pointsBySeries, yTicks, yMax, innerH, innerW, xStep };
  }, [points]);

  const selectedIndex = points.findIndex((p) => p.isSelectedPeriod);
  const displayIndex = hoverIndex !== null ? hoverIndex : selectedIndex >= 0 ? selectedIndex : points.length - 1;
  const displayPoint = displayIndex >= 0 ? points[displayIndex] : null;

  if (loading) {
    return <p className="classification-trend-empty">Loading classification trend…</p>;
  }

  if (points.length === 0) {
    return (
      <p className="classification-trend-empty">
        No historical classification runs overlap this monitoring period. Generate classifications in your courses to
        build a trend.
      </p>
    );
  }

  if (points.length === 1) {
    const point = { ...points[0], coursesInScope };
    return (
      <figure className="classification-trend-chart">
        <p className="classification-trend-single-note">
          One monitoring period with saved runs in this selection. Add runs for other periods to see a line trend.
        </p>
        <TrendSnapshot point={point} />
      </figure>
    );
  }

  if (!geometry) {
    return null;
  }

  const { pointsBySeries, yTicks, yMax, innerH, innerW, xStep } = geometry;

  function handlePlotPointerMove(event) {
    const ratio = Math.min(Math.max(event.nativeEvent.offsetX / innerW, 0), 1);
    const nextIndex = Math.round(ratio * (points.length - 1));
    setHoverIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }

  const highlightBandWidth = Math.max(xStep, 28);

  return (
    <figure className="classification-trend-chart">
      <p className="panel-desc">
        Each point aggregates the latest saved run per course for that monitoring period. X-axis labels are monitoring
        periods, not generation dates.
      </p>
      <div className="classification-trend-chart-body">
        <svg
          className="classification-trend-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="Classification counts across monitoring periods"
        >
          {yTicks.map((tick) => {
            const y = PAD.top + innerH - (tick / yMax) * innerH;
            return (
              <g key={tick}>
                <line x1={PAD.left} x2={CHART_WIDTH - PAD.right} y1={y} y2={y} className="classification-trend-grid" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="classification-trend-axis">
                  {tick}
                </text>
              </g>
            );
          })}
          {hoverIndex !== null ? (
            <rect
              x={PAD.left + xStep * hoverIndex - highlightBandWidth / 2}
              y={PAD.top}
              width={highlightBandWidth}
              height={innerH}
              className="classification-trend-hover-band is-active"
              pointerEvents="none"
            />
          ) : null}
          {points.map((point, index) => (
            <text
              key={periodLabel(point.monitoringPeriodStart, point.monitoringPeriodEnd)}
              x={PAD.left + xStep * index}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className={`classification-trend-axis classification-trend-x-label ${point.isSelectedPeriod ? "is-latest-run" : ""}`}
            >
              {shortPeriodAxis(point.monitoringPeriodStart, point.monitoringPeriodEnd)}
              {point.isSelectedPeriod ? "*" : ""}
            </text>
          ))}
          {pointsBySeries.map(({ series, points: pts }) => (
            <g key={series.key} pointerEvents="none">
              <polyline
                fill="none"
                stroke={series.color}
                strokeWidth="2.5"
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                pointerEvents="none"
              />
              {pts.map((p) => (
                <circle
                  key={p.index}
                  cx={p.x}
                  cy={p.y}
                  r={p.index === selectedIndex ? 5 : 4.5}
                  fill={series.color}
                  pointerEvents="none"
                />
              ))}
            </g>
          ))}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            className="classification-trend-plot-hit"
            onMouseMove={handlePlotPointerMove}
            onMouseLeave={() => setHoverIndex(null)}
          />
        </svg>
        <div className="classification-trend-snapshot-slot">
          {displayPoint ? <TrendSnapshot point={{ ...displayPoint, coursesInScope }} /> : null}
        </div>
      </div>
      {selectedIndex >= 0 ? (
        <p className="classification-trend-latest-legend-note muted">* Selected monitoring period in filters</p>
      ) : null}
    </figure>
  );
}