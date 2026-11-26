import { useId, useMemo, useState } from "react";
import ContentSkeleton, { SkeletonChart } from "../common/ContentSkeleton.jsx";
import { formatRunTitle } from "../../lib/classificationRuns.js";
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

const PAD = { top: 24, right: 20, bottom: 52, left: 48 };

function datePart(value) {
  return String(value || "").slice(0, 10) || "—";
}

function periodLabel(start, end) {
  if (!start || !end) {
    return "—";
  }
  return `${datePart(start)} – ${datePart(end)}`;
}

function shortPeriodAxis(start, end) {
  const s = String(start || "").slice(5, 10);
  const e = String(end || "").slice(5, 10);
  return s && e ? `${s}–${e}` : periodLabel(start, end);
}

function countForPoint(point, key) {
  return Number(point?.counts?.[key]) || 0;
}

function coverageFor(point, fallbackScope) {
  const included = Number(point?.coursesIncluded) || 0;
  const scope = Number(point?.coursesInScope ?? fallbackScope ?? included) || 0;
  return { included, scope };
}

function buildPeriodTooltipText(point, fallbackScope) {
  const { included, scope } = coverageFor(point, fallbackScope);
  return [
    `Monitoring period ${periodLabel(point?.monitoringPeriodStart, point?.monitoringPeriodEnd)}`,
    point?.isSelectedPeriod ? "Selected period in filters" : null,
    point?.incompleteCoverage ? `Partial coverage: ${included} of ${scope} courses` : null,
    ...CLASSIFICATION_TREND_SERIES.map(
      (series) => `${classificationCountLabel(series)}: ${countForPoint(point, series.key)}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function PeriodSnapshot({
  point,
  coursesInScope = 0,
  periodNumber = null,
  totalPeriods = null,
  selectedKey = null,
  compact = false,
  showCourseRuns = true,
}) {
  const start = datePart(point?.monitoringPeriodStart);
  const end = datePart(point?.monitoringPeriodEnd);
  const { included, scope } = coverageFor(point, coursesInScope);

  return (
    <div className={`classification-trend-run-tooltip classification-trend-snapshot ${compact ? "is-compact" : ""}`}>
      {periodNumber !== null ? (
        <span className="classification-trend-run-tooltip-sequence">
          Monitoring period {periodNumber} of {totalPeriods}
        </span>
      ) : null}
      <p className="classification-trend-run-tooltip-title">
        Monitoring period {periodLabel(start, end)}
        {point?.isSelectedPeriod ? <span className="classification-trend-latest-badge"> Selected period</span> : null}
      </p>
      <p className="classification-trend-run-tooltip-date">
        <span className="classification-trend-tooltip-k">Start</span> {start}
      </p>
      <p className="classification-trend-run-tooltip-period">
        <span className="classification-trend-tooltip-k">End</span> {end}
      </p>
      <p className="classification-trend-run-tooltip-coverage">
        <span className="classification-trend-tooltip-k">Course coverage</span> {included} of {scope} courses
      </p>
      {point?.incompleteCoverage ? (
        <p className="panel-desc classification-trend-coverage-warn">
          Partial coverage: {included} of {scope} courses have runs for this period.
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
            <dd>{countForPoint(point, series.key)}</dd>
          </div>
        ))}
      </dl>
      {showCourseRuns && point?.courseRuns?.length ? (
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
    </div>
  );
}

export default function GeneralOverviewTrendChart({
  trend,
  loading = false,
  coursesInScope = 0,
  classificationFilter = ALL_CLASSIFICATIONS,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const tooltipId = useId();
  const points = useMemo(() => trend?.points || [], [trend]);

  // Filtering only changes which series are drawn. The aggregated counts,
  // coverage, ordering and contributing runs all remain untouched.
  const visibleSeries = useMemo(() => visibleTrendSeries(classificationFilter), [classificationFilter]);

  const geometry = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const innerW = CHART_WIDTH - PAD.left - PAD.right;
    const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
    let yMax = 0;
    for (const point of points) {
      for (const series of CLASSIFICATION_TREND_SERIES) {
        yMax = Math.max(yMax, Number(point.counts?.[series.key]) || 0);
      }
    }
    yMax = Math.max(yMax, 1);
    const xStep = innerW / (points.length - 1);
    const pointsBySeries = visibleSeries.map((series) => ({
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
  }, [points, visibleSeries]);

  const selectedIndex = points.findIndex((point) => point.isSelectedPeriod);
  // Points arrive sorted by monitoring-period dates; the last one is the most recent.
  const latestPeriodIndex = points.length - 1;
  const resolvedPanelIndex = selectedIndex >= 0 ? selectedIndex : latestPeriodIndex;
  const activeIndex = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length ? hoverIndex : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeX = activeIndex !== null && geometry ? PAD.left + geometry.xStep * activeIndex : null;
  const tooltipPlacement = activeX !== null ? trendTooltipPlacement(activeX / CHART_WIDTH) : "center";
  const selectedKey = classificationFilter !== ALL_CLASSIFICATIONS ? classificationFilter : null;
  const scope = Number(trend?.coursesInScope ?? coursesInScope ?? 0) || 0;

  if (loading) {
    return (
      <ContentSkeleton loading label="Preparing engagement analytics…">
        <SkeletonChart seriesCount={visibleTrendSeries(classificationFilter).length} showSnapshot />
      </ContentSkeleton>
    );
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
    return (
      <figure className="classification-trend-chart">
        <p className="classification-trend-single-note">
          One monitoring period with saved runs in this selection. Add runs for other periods to see a line trend.
        </p>
        <PeriodSnapshot point={points[0]} coursesInScope={scope} />
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
    const nextIndex = plotIndexFromPointer(svgX - PAD.left, innerW, points.length);
    setHoverIndex((previous) => (previous === nextIndex ? previous : nextIndex));
  }

  function handlePointerLeave() {
    setHoverIndex(null);
  }

  function handleChartKeyDown(event) {
    const current = activeIndex ?? resolvedPanelIndex;
    let next = null;
    if (event.key === "ArrowRight") {
      next = Math.min(points.length - 1, current + 1);
    } else if (event.key === "ArrowLeft") {
      next = Math.max(0, current - 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = points.length - 1;
    } else if (event.key === "Escape") {
      setHoverIndex(null);
      return;
    } else {
      return;
    }
    event.preventDefault();
    setHoverIndex(next);
  }

  const keyboardIndex = activeIndex ?? resolvedPanelIndex;
  const keyboardPoint = points[keyboardIndex];

  return (
    <figure className="classification-trend-chart">
      <p className="panel-desc">
        Each point aggregates the latest saved run per course for that monitoring period. X-axis labels are monitoring
        periods, not generation dates.
      </p>
      <div className="classification-trend-chart-body">
        <div className="classification-trend-plot-wrap">
          <svg
            className="classification-trend-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="group"
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
            {points.map((point, index) => (
              <text
                key={periodLabel(point.monitoringPeriodStart, point.monitoringPeriodEnd)}
                x={PAD.left + xStep * index}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                className={`classification-trend-axis classification-trend-x-label ${point.isSelectedPeriod ? "is-latest-run" : ""} ${index === latestPeriodIndex ? "is-latest-period" : ""} ${index === activeIndex ? "is-hovered" : ""}`}
              >
                {shortPeriodAxis(point.monitoringPeriodStart, point.monitoringPeriodEnd)}
                {point.isSelectedPeriod ? "*" : ""}
              </text>
            ))}
            {pointsBySeries.map(({ series, points: seriesPoints }) => (
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
                  points={seriesPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  pointerEvents="none"
                />
                {seriesPoints.map((point) => {
                  const isHovered = point.index === activeIndex;
                  const isSelected = Boolean(points[point.index]?.isSelectedPeriod);
                  const isLatestPeriod = point.index === latestPeriodIndex;
                  const isDistinct = isSelected || isLatestPeriod;
                  const radius = isHovered
                    ? isDistinct
                      ? POINT_RADIUS_LATEST_HOVER
                      : POINT_RADIUS_HOVER
                    : isDistinct
                      ? POINT_RADIUS_LATEST
                      : POINT_RADIUS;
                  return (
                    <circle
                      key={point.index}
                      cx={point.x}
                      cy={point.y}
                      r={radius}
                      fill={series.color}
                      className={`classification-trend-point ${isSelected ? "is-latest-run" : ""} ${isLatestPeriod ? "is-latest-period" : ""} ${isHovered ? "is-hovered" : ""} ${activeIndex !== null && !isHovered ? "is-muted" : ""}`}
                      stroke={isDistinct ? "var(--color-text)" : isHovered ? "var(--color-surface)" : "none"}
                      strokeWidth={isDistinct ? 1.5 : isHovered ? 2 : 0}
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
              aria-label="Inspect historical monitoring period"
              aria-valuemin={1}
              aria-valuemax={points.length}
              aria-valuenow={keyboardIndex + 1}
              aria-valuetext={keyboardPoint ? buildPeriodTooltipText(keyboardPoint, scope) : undefined}
              aria-describedby={activePoint ? tooltipId : undefined}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerLeave}
              onFocus={() => setHoverIndex(resolvedPanelIndex)}
              onBlur={handlePointerLeave}
              onKeyDown={handleChartKeyDown}
            />
          </svg>
          {activePoint ? (
            <div
              className={`classification-trend-hover-tooltip is-${tooltipPlacement}`}
              style={{ left: `${(activeX / CHART_WIDTH) * 100}%` }}
              id={tooltipId}
              role="tooltip"
            >
              <PeriodSnapshot
                point={activePoint}
                coursesInScope={scope}
                periodNumber={activeIndex + 1}
                totalPeriods={points.length}
                selectedKey={selectedKey}
                compact
                showCourseRuns={false}
              />
            </div>
          ) : null}
        </div>
        <div className="classification-trend-snapshot-slot" role="group" aria-label="Selected monitoring period summary">
          <PeriodSnapshot point={points[resolvedPanelIndex]} coursesInScope={scope} />
        </div>
      </div>
      {selectedIndex >= 0 ? (
        <p className="classification-trend-latest-legend-note muted">* Selected monitoring period in filters</p>
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
