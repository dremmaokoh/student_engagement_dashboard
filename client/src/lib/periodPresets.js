function toIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

export function periodFromPreset(preset, customStart, customEnd) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);

  if (preset === "7") {
    start.setUTCDate(end.getUTCDate() - 6);
    return { periodStart: toIsoDay(start), periodEnd: toIsoDay(end) };
  }
  if (preset === "14") {
    start.setUTCDate(end.getUTCDate() - 13);
    return { periodStart: toIsoDay(start), periodEnd: toIsoDay(end) };
  }
  if (preset === "30") {
    start.setUTCDate(end.getUTCDate() - 29);
    return { periodStart: toIsoDay(start), periodEnd: toIsoDay(end) };
  }
  return {
    periodStart: customStart || "2026-10-01",
    periodEnd: customEnd || "2026-10-31",
  };
}

export const PERIOD_PRESETS = [
  { value: "all", label: "All available periods" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "custom", label: "Custom date range" },
];

export function isLatestPeriodPreset(preset) {
  return preset === "all";
}

/** Query params for dashboard APIs (summary, comparison, trend, attention). */
export function buildDashboardQueryParams({ courseId = "all", preset, customStart, customEnd }) {
  const params = new URLSearchParams({ courseId });
  params.set("preset", preset);
  if (isLatestPeriodPreset(preset)) {
    params.set("periodScope", "latest");
    return params;
  }
  params.set("periodScope", "fixed");
  const period = periodFromPreset(preset, customStart, customEnd);
  params.set("periodStart", period.periodStart);
  params.set("periodEnd", period.periodEnd);
  return params;
}
