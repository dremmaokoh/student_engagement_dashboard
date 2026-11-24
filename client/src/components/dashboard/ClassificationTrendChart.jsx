import { useId, useMemo, useState } from "react";
import LoadingState from "../common/LoadingState.jsx";
import { formatRunTitle, runPeriodLabel } from "../../lib/classificationRuns.js";
import {
  ALL_CLASSIFICATIONS,
  CHART_HEIGHT,
  CHART_WIDTH,
  CLASSIFICATION_TREND_SERIES,
  classificationCountLabel,
  plotIndexFromPointer,
  pointerSvgX,
  POINT_RADIUS,
  POINT_RADIUS_HOVER,
  POINT_RADIUS_LATEST,
  POINT_RADIUS_LATEST_HOVER,
  trendTooltipPlacement,
  visibleTrendSeries,
} from "../../lib/classificationTrend.js";

const PAD = { top: 24, right: 20, bottom: 44, left: 48 };

function formatRunDate(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function runSequenceLabel(index) {
  return `Run ${index + 1}`;
}

function countForRun(run, key) {
  return Number(run?.counts?.[key]) || 0;
}

function buildRunTooltipText(run, courseCode) {
  const period = runPeriodLabel(run);
  return [
    formatRunTitle(courseCode, run?.runName),
    `Generated ${formatRunDate(run.generatedAt)}`,
    period ? `Monitoring period ${period}` : "Monitoring period —",
    ...CLASSIFICATION_TREND_SERIES.map((series) => `${classificationCountLabel(series)}: ${countForRun(run, series.key)}`),
  ].join("\n");
}

function RunCountSnapshot({
  run,
  courseCode = "",
  interactive = false,
  isLatest = false,
  runNumber = null,
  selectedKey = null,
  showPeriod = true,
  compact = false,
}) {
  const period = runPeriodLabel(run);
  const runTitle = formatRunTitle(courseCode, run?.runName);
  return (
    <div
      className={`classification-trend-run-tooltip classification-trend-snapshot ${compact ? "is-compact" : ""} ${interactive ? "is-interactive" : ""} ${isLatest ? "is-latest-run" : ""}`}
      role={interactive ? "status" : undefined}
    >
      {runNumber !== null ? (
        <span className="classification-trend-run-tooltip-sequence">{runSequenceLabel(runNumber - 1)}</span>
      ) : null}
      <p className="classification-trend-run-tooltip-title">
        {runTitle}
        {isLatest ? <span className="classification-trend-latest-badge"> Latest run</span> : null}
      </p>
      <p className="classification-trend-run-tooltip-date">
        <span className="classification-trend-tooltip-k">Generated</span> {formatRunDate(run.generatedAt)}
      </p>
      {showPeriod && period ? (
        <p className="classification-trend-run-tooltip-period">
          <span className="classification-trend-tooltip-k">Monitoring period</span> {period}
        </p>
      ) : null}
      <dl className="classification-trend-run-tooltip-stats">
        {CLASSIFICATION_TREND_SERIES.map((series) => (
          <div
            key={series.key}
            className={`classification-trend-run-tooltip-stat ${selectedKey === series.key ? "is-selected" : ""}`}
          >
            <dt>
              <span className="classification-trend-legend-line" style={{ background: series.color }} aria-hidden="true" />
              {classificationCountLabel(series)}
            </dt>
            <dd>{countForRun(run, series.key)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ClassificationTrendChart({
  runs = [],
  loading = false,
  latestRunId = "",
  courseCode = "",
  classificationFilter = ALL_CLASSIFICATIONS,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const tooltipId = useId();

  const chronological = useMemo(
    () => [...runs].sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt)),
    [runs],
  );

  const latestIndex = useMemo(() => {
    if (!latestRunId) {
      return chronological.length > 0 ? chronological.length - 1 : -1;
    }
    return chronological.findIndex((run) => String(run.runId) === String(latestRunId));
  }, [chronological, latestRunId]);

  // Filtering only changes which series are drawn. All counts are still read
  // from the same run objects, and the y-axis stays comparable across filters.
  const visibleSeries = useMemo(() => visibleTrendSeries(classificationFilter), [classificationFilter]);

  const geometry = useMemo(() => {
    if (chronological.length < 2) {
      return null;
    }
    const innerW = CHART_WIDTH - PAD.left - PAD.right;
    const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
    let yMax = 0;
    for (const run of chronological) {
      for (const series of CLASSIFICATION_TREND_SERIES) {
        yMax = Math.max(yMax, Number(run.counts?.[series.key]) || 0);
      }
    }
    yMax = Math.max(yMax, 1);
    const xStep = innerW / (chronological.length - 1);

    const pointsBySeries = visibleSeries.map((series) => {
      const points = chronological.map((run, index) => {
        const value = Number(run.counts?.[series.key]) || 0;
        const x = PAD.left + xStep * index;
        const y = PAD.top + innerH - (value / yMax) * innerH;
        return { x, y, value, runId: run.runId, index };
      });
      return { series, points };
    });

    const yTicks = [0, Math.ceil(yMax / 2), yMax];
    return { pointsBySeries, yTicks, yMax, innerH, innerW, xStep };
  }, [chronological, visibleSeries]);

  const resolvedLatestIndex =
    latestIndex >= 0 ? latestIndex : chronological.length > 0 ? chronological.length - 1 : -1;
  const activeIndex = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < chronological.length ? hoverIndex : null;
  const activeRun = activeIndex !== null ? chronological[activeIndex] : null;
  const activeX = activeIndex !== null && geometry ? PAD.left + geometry.xStep * activeIndex : null;
  const tooltipPlacement = activeX !== null ? trendTooltipPlacement(activeX / CHART_WIDTH) : "center";
  const selectedKey = classificationFilter !== ALL_CLASSIFICATIONS ? classificationFilter : null;

  if (loading) {
    return (
      <LoadingState loading variant="inline" message="Preparing classification history…" />
    );
  }

  if (chronological.length === 0) {
    return (
      <p className="classification-trend-empty">
        No classification runs yet. Generate classifications from the Monitoring tab to begin tracking trends here.
      </p>
    );
  }

  if (chronological.length === 1) {
    const run = chronological[0];
    return (
      <figure className="classification-trend-chart">
        <p className="classification-trend-single-note">
          One classification run saved for this course. Values below are from that run. A line trend appears after you
          generate again.
        </p>
        <RunCountSnapshot run={run} courseCode={courseCode} interactive isLatest />
      </figure>
    );
  }

  if (!geometry) {
    return null;
  }

  const { pointsBySeries, yTicks, yMax, innerH, innerW, xStep } = geometry;

  function handlePointerMove(event) {
    const svgX = pointerSvgX(event);
    if (svgX === null) {
      return;
    }
    const nextIndex = plotIndexFromPointer(svgX - PAD.left, innerW, chronological.length);
    setHoverIndex((previous) => (previous === nextIndex ? previous : nextIndex));
  }

  function handlePointerLeave() {
    setHoverIndex(null);
  }

  function handleChartKeyDown(event) {
    const current = activeIndex ?? resolvedLatestIndex;
    let next = null;
    if (event.key === "ArrowRight") {
      next = Math.min(chronological.length - 1, current + 1);
    } else if (event.key === "ArrowLeft") {
      next = Math.max(0, current - 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = chronological.length - 1;
    } else if (event.key === "Escape") {
      setHoverIndex(null);
      return;
    } else {
      return;
    }
    event.preventDefault();
    setHoverIndex(next);
  }

  const keyboardRunIndex = activeIndex ?? resolvedLatestIndex;
  const keyboardRun = chronological[keyboardRunIndex];

  return (
    <figure className="classification-trend-chart">
      <div className="classification-trend-chart-body">
        <div className="classification-trend-plot-wrap">
          <svg
            className="classification-trend-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="group"
            aria-label="Classification counts over historical classification runs"
          >
            {yTicks.map((tick) => {
              const y = PAD.top + innerH - (tick / yMax) * innerH;
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={CHART_WIDTH - PAD.right}
                    y1={y}
                    y2={y}
                    className="classification-trend-grid"
                  />
                  <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="classification-trend-axis">
                    {tick}
                  </text>
                </g>
              );
            })}
            {activeIndex !== null ? (
              <line
                x1={activeX}
                x2={activeX}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="classification-trend-crosshair"
                pointerEvents="none"
              />
            ) : null}
            {chronological.map((run, index) => {
              const x = PAD.left + xStep * index;
              return (
                <text
                  key={run.runId}
                  x={x}
                  y={CHART_HEIGHT - 12}
                  textAnchor="middle"
                  className={`classification-trend-axis classification-trend-x-label ${index === resolvedLatestIndex ? "is-latest-run" : ""} ${index === activeIndex ? "is-hovered" : ""}`}
                >
                  {runSequenceLabel(index)}
                  {index === resolvedLatestIndex ? "*" : ""}
                </text>
              );
            })}
            {pointsBySeries.map(({ series, points }) => (
              <g
                key={series.key}
                className={`classification-trend-series ${activeIndex !== null ? "is-muted" : ""}`}
                pointerEvents="none"
              >
                <polyline
                  className={`classification-trend-line ${selectedKey === series.key ? "is-selected" : ""}`}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pointerEvents="none"
                  points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                />
                {points.map((point) => {
                  const isHovered = point.index === activeIndex;
                  const isLatest = point.index === resolvedLatestIndex;
                  const radius = isHovered
                    ? isLatest
                      ? POINT_RADIUS_LATEST_HOVER
                      : POINT_RADIUS_HOVER
                    : isLatest
                      ? POINT_RADIUS_LATEST
                      : POINT_RADIUS;
                  return (
                    <circle
                      key={`${series.key}-${point.runId}`}
                      cx={point.x}
                      cy={point.y}
                      r={radius}
                      fill={series.color}
                      className={`classification-trend-point ${isLatest ? "is-latest-run" : ""} ${isHovered ? "is-hovered" : ""} ${activeIndex !== null && !isHovered ? "is-muted" : ""}`}
                      stroke={isLatest ? "var(--color-text)" : isHovered ? "var(--color-surface)" : "none"}
                      strokeWidth={isLatest ? 1.5 : isHovered ? 2 : 0}
                      pointerEvents="none"
                    />
                  );
                })}
              </g>
            ))}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={innerW}
              height={innerH}
              className="classification-trend-plot-hit"
              tabIndex={0}
              role="slider"
              aria-label="Inspect historical classification run"
              aria-valuemin={1}
              aria-valuemax={chronological.length}
              aria-valuenow={keyboardRunIndex + 1}
              aria-valuetext={keyboardRun ? buildRunTooltipText(keyboardRun, courseCode) : undefined}
              aria-describedby={activeRun ? tooltipId : undefined}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerLeave}
              onFocus={() => setHoverIndex(resolvedLatestIndex)}
              onBlur={handlePointerLeave}
              onKeyDown={handleChartKeyDown}
            />
          </svg>
          {activeRun ? (
            <div
              className={`classification-trend-hover-tooltip is-${tooltipPlacement}`}
              style={{ left: `${(activeX / CHART_WIDTH) * 100}%` }}
              id={tooltipId}
              role="tooltip"
            >
              <RunCountSnapshot
                run={activeRun}
                courseCode={courseCode}
                isLatest={activeIndex === resolvedLatestIndex}
                runNumber={activeIndex + 1}
                selectedKey={selectedKey}
                showPeriod={false}
                compact
              />
            </div>
          ) : null}
        </div>
        <div className="classification-trend-snapshot-slot" role="group" aria-label="Latest classification run summary">
          <RunCountSnapshot run={chronological[resolvedLatestIndex]} courseCode={courseCode} isLatest />
        </div>
      </div>
      {resolvedLatestIndex >= 0 ? (
        <p className="classification-trend-latest-legend-note muted">
          * Latest run ({runSequenceLabel(resolvedLatestIndex)}), oldest to newest left to right
        </p>
      ) : null}
      <ul className="classification-trend-legend">
        {visibleSeries.map((series) => (
          <li key={series.key} className={`classification-trend-legend-item ${series.className}`}>
            <span className="classification-trend-legend-line" style={{ background: series.color }} aria-hidden="true" />
            {series.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
