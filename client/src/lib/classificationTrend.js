import { CLASSIFICATION_COLOR_VARS, classificationLabel } from "./classifications.js";

export const ALL_CLASSIFICATIONS = "all";
export const ALL_CLASSIFICATIONS_LABEL = "All classifications";

/** Shared chart geometry and marker sizes for both classification trend graphs. */
export const CHART_WIDTH = 720;
export const CHART_HEIGHT = 260;
export const POINT_RADIUS = 4.5;
export const POINT_RADIUS_LATEST = 5;
export const POINT_RADIUS_HOVER = 6.5;
export const POINT_RADIUS_LATEST_HOVER = 7;

const SERIES_CLASS_NAMES = {
  ACTIVE: "trend-active",
  REQUIRING_ATTENTION: "trend-attention",
  INACTIVE: "trend-inactive",
  INSUFFICIENT_DATA: "trend-insufficient",
};

/** Shared presentation metadata for the four stored classification result keys. */
export const CLASSIFICATION_TREND_SERIES = Object.entries(CLASSIFICATION_COLOR_VARS).map(([key, color]) => ({
  key,
  color,
  label: classificationLabel(key),
  className: SERIES_CLASS_NAMES[key],
}));

export const CLASSIFICATION_FILTER_OPTIONS = [
  { value: ALL_CLASSIFICATIONS, label: ALL_CLASSIFICATIONS_LABEL, color: null },
  ...CLASSIFICATION_TREND_SERIES.map(({ key, label, color }) => ({ value: key, label, color })),
];

/** Shared tooltip/stat labels so both trend graphs describe counts identically. */
export function classificationCountLabel(series) {
  if (series.key === "ACTIVE" || series.key === "INACTIVE") {
    return `${series.label} student count`;
  }
  return `${series.label} count`;
}

/** Only changes which series are drawn; the supplied classification data is never touched. */
export function visibleTrendSeries(filterValue) {
  if (filterValue === ALL_CLASSIFICATIONS) {
    return CLASSIFICATION_TREND_SERIES;
  }
  const match = CLASSIFICATION_TREND_SERIES.find((series) => series.key === filterValue);
  return match ? [match] : CLASSIFICATION_TREND_SERIES;
}

/** Keeps the floating tooltip inside the plot at either end of the run/period sequence. */
export function trendTooltipPlacement(xRatio) {
  if (xRatio < 0.3) {
    return "start";
  }
  if (xRatio > 0.7) {
    return "end";
  }
  return "center";
}

/** Maps a plot-relative x position to the nearest run/monitoring-period index. */
export function plotIndexFromPointer(relativeX, innerW, itemCount) {
  if (itemCount <= 1) {
    return 0;
  }
  const ratio = Math.min(Math.max(relativeX / innerW, 0), 1);
  return Math.round(ratio * (itemCount - 1));
}

/** Converts a pointer position into viewBox coordinates so hovering works at any CSS width. */
export function pointerSvgX(event) {
  const svg = event.currentTarget.ownerSVGElement;
  if (!svg) {
    return null;
  }
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width) {
    return null;
  }
  return ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
}
