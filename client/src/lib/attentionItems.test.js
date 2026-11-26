import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTENTION_LIMIT,
  assertAttentionDashboardsMatchRun,
  attentionDashboardParams,
  attentionItemsFromDashboards,
} from "./attentionItems.js";

function dashboard(items, overrides = {}) {
  return {
    runId: "run-1",
    counts: {
      total: items.length,
      ACTIVE: 0,
      REQUIRING_ATTENTION: 0,
      INACTIVE: 0,
      INSUFFICIENT_DATA: 0,
    },
    results: { items, total: items.length, page: 1, limit: ATTENTION_LIMIT },
    ...overrides,
  };
}

function item(id, classification) {
  return { id, classification, displayScore: 10 };
}

test("shows inactive students and never falls back to the empty state", () => {
  const items = attentionItemsFromDashboards([dashboard([item("i1", "INACTIVE")])]);
  assert.deepEqual(
    items.map((row) => row.id),
    ["i1"],
  );
});

test("shows students requiring attention", () => {
  const items = attentionItemsFromDashboards([dashboard([item("r1", "REQUIRING_ATTENTION")])]);
  assert.deepEqual(
    items.map((row) => row.id),
    ["r1"],
  );
});

test("shows both classifications when both exist", () => {
  const inactive = dashboard(Array.from({ length: 8 }, (_, index) => item(`i${index}`, "INACTIVE")));
  const requiring = dashboard(Array.from({ length: 8 }, (_, index) => item(`r${index}`, "REQUIRING_ATTENTION")));
  const items = attentionItemsFromDashboards([inactive, requiring]);
  assert.equal(items.length, ATTENTION_LIMIT);
  assert.ok(items.some((row) => row.classification === "INACTIVE"));
  assert.ok(items.some((row) => row.classification === "REQUIRING_ATTENTION"));
});

test("returns an empty list when only active and insufficient data records exist", () => {
  const items = attentionItemsFromDashboards([
    dashboard([item("a1", "ACTIVE"), item("u1", "INSUFFICIENT_DATA")]),
  ]);
  assert.deepEqual(items, []);
});

test("dashboard params carry the selected period and classification", () => {
  const params = attentionDashboardParams(
    { periodStart: "2026-09-01", periodEnd: "2026-09-30" },
    "run-1",
    "INACTIVE",
  );
  assert.equal(params.get("periodStart"), "2026-09-01");
  assert.equal(params.get("periodEnd"), "2026-09-30");
  assert.equal(params.get("runId"), "run-1");
  assert.equal(params.get("classification"), "INACTIVE");
  assert.equal(params.get("limit"), String(ATTENTION_LIMIT));
});

test("rejects dashboards that do not match the latest run", () => {
  const latestRun = {
    runId: "run-2",
    counts: {
      total: 1,
      ACTIVE: 0,
      REQUIRING_ATTENTION: 0,
      INACTIVE: 1,
      INSUFFICIENT_DATA: 0,
    },
  };
  assert.throws(
    () => assertAttentionDashboardsMatchRun([dashboard([item("i1", "INACTIVE")])], latestRun),
    /latest classification run/,
  );
});
