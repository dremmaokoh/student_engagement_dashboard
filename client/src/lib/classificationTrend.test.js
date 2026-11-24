import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_CLASSIFICATIONS,
  CLASSIFICATION_TREND_SERIES,
  classificationCountLabel,
  plotIndexFromPointer,
  trendTooltipPlacement,
  visibleTrendSeries,
} from "./classificationTrend.js";

test("all classifications displays all four series in a stable order", () => {
  const series = visibleTrendSeries(ALL_CLASSIFICATIONS);
  assert.deepEqual(
    series.map((item) => item.key),
    ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"],
  );
});

test("an individual classification selects one series without mutating the shared series data", () => {
  const before = CLASSIFICATION_TREND_SERIES.map((item) => ({ ...item }));
  const series = visibleTrendSeries("REQUIRING_ATTENTION");

  assert.equal(series.length, 1);
  assert.equal(series[0].key, "REQUIRING_ATTENTION");
  assert.equal(series[0], CLASSIFICATION_TREND_SERIES[1]);
  assert.deepEqual(CLASSIFICATION_TREND_SERIES, before);
});

test("an unknown filter falls back to all series", () => {
  assert.equal(visibleTrendSeries("NOT_A_CLASSIFICATION"), CLASSIFICATION_TREND_SERIES);
});

test("tooltip placement flips near the plot edges to avoid clipping", () => {
  assert.equal(trendTooltipPlacement(0.07), "start");
  assert.equal(trendTooltipPlacement(0.5), "center");
  assert.equal(trendTooltipPlacement(0.97), "end");
});

test("pointer mapping picks the nearest run or monitoring-period index", () => {
  assert.equal(plotIndexFromPointer(0, 600, 5), 0);
  assert.equal(plotIndexFromPointer(300, 600, 5), 2);
  assert.equal(plotIndexFromPointer(600, 600, 5), 4);
  assert.equal(plotIndexFromPointer(-50, 600, 5), 0);
  assert.equal(plotIndexFromPointer(650, 600, 5), 4);
});

test("both trend graphs use the same count labels", () => {
  assert.equal(classificationCountLabel(CLASSIFICATION_TREND_SERIES[0]), "Active student count");
  assert.equal(classificationCountLabel(CLASSIFICATION_TREND_SERIES[1]), "Requiring Attention count");
  assert.equal(classificationCountLabel(CLASSIFICATION_TREND_SERIES[2]), "Inactive student count");
  assert.equal(classificationCountLabel(CLASSIFICATION_TREND_SERIES[3]), "Insufficient Data count");
});
