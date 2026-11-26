import { ymd } from "./classificationRuns.js";

export const ATTENTION_CLASSIFICATIONS = Object.freeze(["INACTIVE", "REQUIRING_ATTENTION"]);
export const ATTENTION_LIMIT = 5;

function itemsForClassification(dashboards, classification) {
  const items = [];
  for (const dashboard of dashboards) {
    for (const item of dashboard?.results?.items || []) {
      if (item.classification === classification) {
        items.push(item);
      }
    }
  }
  return items;
}

export function attentionItemsFromDashboards(dashboards = []) {
  const inactive = itemsForClassification(dashboards, "INACTIVE");
  const requiringAttention = itemsForClassification(dashboards, "REQUIRING_ATTENTION");

  if (inactive.length && requiringAttention.length) {
    return [...inactive.slice(0, ATTENTION_LIMIT - 1), requiringAttention[0]];
  }

  return [...inactive, ...requiringAttention].slice(0, ATTENTION_LIMIT);
}

export function attentionDashboardParams(period, runId, classification) {
  return new URLSearchParams({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    runId,
    classification,
    limit: String(ATTENTION_LIMIT),
    sortBy: "overallScore",
    sortDir: "asc",
    page: "1",
  });
}

export function assertAttentionDashboardsMatchRun(dashboards, latestRun) {
  if (!latestRun?.runId || !latestRun?.counts) {
    return;
  }
  for (const dashboard of dashboards) {
    if (dashboard?.runId !== latestRun.runId) {
      throw new Error("Students needing attention could not be matched to the latest classification run.");
    }
    const countsMatch = ["total", "ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"].every(
      (key) => dashboard.counts?.[key] === latestRun.counts[key],
    );
    if (!countsMatch) {
      throw new Error("Classification summary and student records are out of sync. Please generate a new run.");
    }
  }
}

export function latestPeriodQuery(run) {
  if (!run?.monitoringPeriodStart || !run?.monitoringPeriodEnd) {
    return null;
  }
  return {
    periodStart: ymd(run.monitoringPeriodStart),
    periodEnd: ymd(run.monitoringPeriodEnd),
  };
}
