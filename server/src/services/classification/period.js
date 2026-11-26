import { HttpError } from "../../utils/httpError.js";

export function normalizePeriodDate(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return null;
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return null;
    }
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsedDay = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== text) {
      return null;
    }
    return parsedDay;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function periodDayKey(raw) {
  const normalized = normalizePeriodDate(raw);
  if (!normalized) {
    return "";
  }
  return normalized.toISOString().slice(0, 10);
}

export function periodsEquivalent(leftStart, leftEnd, rightStart, rightEnd) {
  return (
    periodDayKey(leftStart) === periodDayKey(rightStart) &&
    periodDayKey(leftEnd) === periodDayKey(rightEnd)
  );
}

export function parsePeriodDate(raw, field) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    throw new HttpError(400, `${field} is required.`);
  }
  const normalized = normalizePeriodDate(raw);
  if (!normalized) {
    throw new HttpError(400, `${field} is not a valid date.`);
  }
  return normalized;
}

export function parseMonitoringPeriod(input) {
  const monitoringPeriodStart = parsePeriodDate(
    input.monitoringPeriodStart || input.periodStart,
    "monitoringPeriodStart",
  );
  const monitoringPeriodEnd = parsePeriodDate(
    input.monitoringPeriodEnd || input.periodEnd,
    "monitoringPeriodEnd",
  );
  if (monitoringPeriodEnd.getTime() < monitoringPeriodStart.getTime()) {
    throw new HttpError(400, "Period end cannot precede period start.");
  }
  return { monitoringPeriodStart, monitoringPeriodEnd };
}

export function periodFilter(start, end) {
  const monitoringPeriodStart = normalizePeriodDate(start);
  const monitoringPeriodEnd = normalizePeriodDate(end);
  if (!monitoringPeriodStart || !monitoringPeriodEnd) {
    throw new HttpError(400, "Monitoring period dates are invalid.");
  }
  return {
    monitoringPeriodStart,
    monitoringPeriodEnd,
  };
}
