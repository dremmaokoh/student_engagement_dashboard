export const DEFAULT_PERIOD_START = "2026-10-01";
export const DEFAULT_PERIOD_END = "2026-10-31";

export function readCoursePeriod(searchParams) {
  const periodStart = searchParams.get("periodStart") || DEFAULT_PERIOD_START;
  const periodEnd = searchParams.get("periodEnd") || DEFAULT_PERIOD_END;
  return { periodStart, periodEnd };
}

/** Query string for course workspace tab links (period + optional runId). */
export function courseWorkspaceQuery(searchParams) {
  const params = new URLSearchParams();
  if (searchParams.get("periodStart")) {
    params.set("periodStart", searchParams.get("periodStart"));
  }
  if (searchParams.get("periodEnd")) {
    params.set("periodEnd", searchParams.get("periodEnd"));
  }
  const runId = searchParams.get("runId");
  if (runId) {
    params.set("runId", runId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasExplicitCoursePeriod(searchParams) {
  return searchParams.has("periodStart") && searchParams.has("periodEnd");
}

/** @deprecated Use courseMonitoringPath */
export function courseStudentsPath(courseId, options = {}) {
  return courseMonitoringPath(courseId, options);
}

export function courseMonitoringPath(courseId, { periodStart, periodEnd, classification = "", ...rest } = {}) {
  const params = new URLSearchParams();
  if (periodStart) {
    params.set("periodStart", periodStart);
  }
  if (periodEnd) {
    params.set("periodEnd", periodEnd);
  }
  if (classification) {
    params.set("classification", classification);
  }
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return `/courses/${courseId}/monitoring${query ? `?${query}` : ""}`;
}

export function courseResultsPath(courseId, { periodStart, periodEnd, runId } = {}) {
  const params = new URLSearchParams();
  if (periodStart) {
    params.set("periodStart", periodStart);
  }
  if (periodEnd) {
    params.set("periodEnd", periodEnd);
  }
  if (runId) {
    params.set("runId", runId);
  }
  const query = params.toString();
  return `/courses/${courseId}/results${query ? `?${query}` : ""}`;
}

export function courseOverviewPath(courseId, { periodStart, periodEnd } = {}) {
  const params = new URLSearchParams();
  if (periodStart) {
    params.set("periodStart", periodStart);
  }
  if (periodEnd) {
    params.set("periodEnd", periodEnd);
  }
  const query = params.toString();
  return `/courses/${courseId}/overview${query ? `?${query}` : ""}`;
}