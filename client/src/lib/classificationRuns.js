import { classificationLabel } from "./classifications.js";

export const UNNAMED_RUN_LABEL = "Unnamed Run";

export function formatRunTitle(courseCode, runName) {
  const name = String(runName || "").trim() || UNNAMED_RUN_LABEL;
  const code = String(courseCode || "").trim();
  return code ? `${code} – ${name}` : name;
}

export function ymd(value) {
  if (!value) {
    return "";
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return text.slice(0, 10);
}

export function runPeriodLabel(run) {
  if (!run?.monitoringPeriodStart || !run?.monitoringPeriodEnd) {
    return null;
  }
  return `${ymd(run.monitoringPeriodStart)} – ${ymd(run.monitoringPeriodEnd)}`;
}

export function formatCountDelta(current, previous) {
  if (previous === undefined || previous === null) {
    return null;
  }
  const delta = Number(current ?? 0) - Number(previous ?? 0);
  if (delta === 0) {
    return "no change";
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

const COMPARISON_KEYS = ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"];

export function buildChangesSincePreviousCopy(latest, previous) {
  if (!latest?.counts || !previous?.counts) {
    return [];
  }
  const lines = [];
  for (const key of COMPARISON_KEYS) {
    const current = Number(latest.counts[key] ?? 0);
    const prev = Number(previous.counts[key] ?? 0);
    const delta = current - prev;
    const label = classificationLabel(key);
    if (delta === 0) {
      lines.push(`${label} is unchanged.`);
    } else if (delta > 0) {
      lines.push(`${delta} more student${delta === 1 ? "" : "s"} ${classificationPhrase(key)}.`);
    } else {
      const n = Math.abs(delta);
      lines.push(`${n} fewer student${n === 1 ? "" : "s"} ${classificationPhrase(key)}.`);
    }
  }
  return lines;
}

function classificationPhrase(key) {
  const map = {
    ACTIVE: "are Active",
    REQUIRING_ATTENTION: "require Attention",
    INACTIVE: "are Inactive",
    INSUFFICIENT_DATA: "have Insufficient Data",
  };
  return map[key] || classificationLabel(key).toLowerCase();
}