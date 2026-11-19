import { useMemo, useState } from "react";
import { formatRunTitle, runPeriodLabel } from "../../lib/classificationRuns.js";
import { classificationLabel } from "../../lib/classifications.js";

const SERIES = [
  { key: "ACTIVE", color: "var(--color-classification-active)", className: "trend-active" },
  { key: "REQUIRING_ATTENTION", color: "var(--color-classification-attention)", className: "trend-attention" },
  { key: "INACTIVE", color: "var(--color-classification-inactive)", className: "trend-inactive" },
  { key: "INSUFFICIENT_DATA", color: "var(--color-classification-insufficient)", className: "trend-insufficient" },
];

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const PAD = { top: 24, right: 20, bottom: 44, left: 48 };
const POINT_RADIUS = 4.5;
const POINT_RADIUS_LATEST = 5;

function plotIndexFromPointer(relativeX, innerW, runCount) {
  if (runCount <= 1) {
    return 0;
  }
  const ratio = Math.min(Math.max(relativeX / innerW, 0), 1);
  return Math.round(ratio * (runCount - 1));
}

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
    `Active student count: ${countForRun(run, "ACTIVE")}`,
    `Requiring Attention count: ${countForRun(run, "REQUIRING_ATTENTION")}`,
    `Inactive student count: ${countForRun(run, "INACTIVE")}`,
    `Insufficient Data count: ${countForRun(run, "INSUFFICIENT_DATA")}`,
  ].join("\n");
}

function RunCountSnapshot({ run, courseCode = "", interactive = false, isLatest = false }) {
  const period = runPeriodLabel(run);
  const runTitle = formatRunTitle(courseCode, run?.runName);
  return (
    <div
      className={`classification-trend-run-tooltip classification-trend-snapshot ${interactive ? "is-interactive" : ""} ${isLatest ? "is-latest-run" : ""}`}
      role={interactive ? "status" : undefined}
    >
      <p className="classification-trend-run-tooltip-title">
        {runTitle}
        {isLatest ? <span className="classification-trend-latest-badge"> Latest run</span> : null}
      </p>
      <p className="classification-trend-run-tooltip-date">
        <span className="classification-trend-tooltip-k">Generated</span> {formatRunDate(run.generatedAt)}
      </p>
      {period ? (
        <p className="classification-trend-run-tooltip-period">
          <span className="classification-trend-tooltip-k">Monitoring period</span> {period}
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
            <dd>{countForRun(run, series.key)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ClassificationTrendChart({ runs = [], loading = false, latestRunId = "", courseCode = "" }) {
  const [hoverIndex, setHoverIndex] = useState(null);

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

  const geometry = useMemo(() => {
    if (chronological.length < 2) {
      return null;
    }
    const innerW = CHART_WIDTH - PAD.left - PAD.right;
    const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
    let yMax = 0;
    for (const run of chronological) {
      for (const series of SERIES) {
        yMax = Math.max(yMax, Number(run.counts?.[series.key]) || 0);
      }
    }
    yMax = Math.max(yMax, 1);
    const xStep = innerW / (chronological.length - 1);

    const pointsBySeries = SERIES.map((series) => {
      const points = chronological.map((run, index) => {
        const value = Number(run.counts?.[series.key]) || 0;
        const x = PAD.left + xStep * index;
        const y = PAD.top + innerH - (value / yMax) * innerH;
        return { x, y, value, date: run.generatedAt, runId: run.runId, index };
      });
      return { series, points };
    });

    const yTicks = [0, Math.ceil(yMax / 2), yMax];
    return { pointsBySeries, yTicks, yMax, innerH, innerW, xStep };
  }, [chronological]);

  const resolvedLatestIndex =
    latestIndex >= 0 ? latestIndex : chronological.length > 0 ? chronological.length - 1 : -1;
  const displayIndex = hoverIndex !== null ? hoverIndex : resolvedLatestIndex;
  const displayRun = displayIndex >= 0 ? chronological[displayIndex] : null;

  if (loading) {
    return <p className="classification-trend-empty">Loading classification history…</p>;
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

  function handlePlotPointerMove(event) {
    const nextIndex = plotIndexFromPointer(event.nativeEvent.offsetX, innerW, chronological.length);
    setHoverIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }

  function handlePlotPointerLeave() {
    setHoverIndex(null);
  }

  const highlightBandWidth = Math.max(xStep, 28);

  return (
    <figure className="classification-trend-chart">
      <div className="classification-trend-chart-body">
        <svg
          className="classification-trend-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
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
          {chronological.map((run, index) => {
            const x = PAD.left + geometry.xStep * index;
            return (
              <text
                key={run.runId}
                x={x}
                y={CHART_HEIGHT - 12}
                textAnchor="middle"
                className={`classification-trend-axis classification-trend-x-label ${index === latestIndex ? "is-latest-run" : ""}`}
              >
                {runSequenceLabel(index)}
                {index === latestIndex ? "*" : ""}
              </text>
            );
          })}
          {pointsBySeries.map(({ series, points }) => (
            <g key={series.key} className="classification-trend-series" pointerEvents="none">
              <polyline
                fill="none"
                stroke={series.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              />
              {points.map((point) => {
                const pointRun = chronological[point.index];
                const isEmphasis =
                  point.index === latestIndex || (hoverIndex !== null && point.index === hoverIndex);
                return (
                  <circle
                    key={`${series.key}-${point.runId}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.index === latestIndex ? POINT_RADIUS_LATEST : POINT_RADIUS}
                    fill={series.color}
                    className={`classification-trend-point ${point.index === latestIndex ? "is-latest-run" : ""} ${isEmphasis ? "is-emphasis" : ""}`}
                    stroke={point.index === latestIndex ? "var(--color-text)" : "none"}
                    strokeWidth={point.index === latestIndex ? 1.5 : 0}
                    pointerEvents="none"
                  >
                    <title>{buildRunTooltipText(pointRun, courseCode)}</title>
                  </circle>
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
            onMouseMove={handlePlotPointerMove}
            onMouseLeave={handlePlotPointerLeave}
          />
        </svg>
        <div className="classification-trend-snapshot-slot">
          {displayRun ? (
            <RunCountSnapshot
              run={displayRun}
              courseCode={courseCode}
              isLatest={displayIndex === resolvedLatestIndex}
              interactive={false}
            />
          ) : null}
        </div>
      </div>
      {latestIndex >= 0 ? (
        <p className="classification-trend-latest-legend-note muted">
          * Latest run ({runSequenceLabel(latestIndex)}), oldest to newest left to right
        </p>
      ) : null}
      <ul className="classification-trend-legend">
        {SERIES.map((series) => (
          <li key={series.key} className={`classification-trend-legend-item ${series.className}`}>
            <span className="classification-trend-legend-line" style={{ background: series.color }} aria-hidden="true" />
            {classificationLabel(series.key)}
          </li>
        ))}
      </ul>
    </figure>
  );
}