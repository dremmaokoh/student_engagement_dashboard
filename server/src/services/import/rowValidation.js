function blank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function missingOrInteger(raw, field) {
  if (blank(raw)) {
    return { value: null };
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    return { error: { field, reason: `${field} must be a non-negative integer or empty.` } };
  }
  return { value: Number(text) };
}

import { normalizePeriodDate } from "../classification/period.js";

export function missingOrDate(raw, field) {
  if (blank(raw)) {
    return { value: null };
  }
  const normalized = normalizePeriodDate(raw);
  if (!normalized) {
    return { error: { field, reason: `${field} is not a valid date.` } };
  }
  return { value: normalized };
}

export function validateCounts(materialsAvailable, materialsAccessed, assignmentsDue, assignmentsSubmitted) {
  if (materialsAvailable !== null && materialsAccessed !== null && materialsAccessed > materialsAvailable) {
    return { field: "materialsAccessed", reason: "Accessed materials cannot exceed available materials." };
  }
  if (assignmentsDue !== null && assignmentsSubmitted !== null && assignmentsSubmitted > assignmentsDue) {
    return { field: "assignmentsSubmitted", reason: "Submitted assignments cannot exceed assignments due." };
  }
  return null;
}

export function validatePeriod(start, end) {
  if (!start || !end) {
    return { field: "monitoringPeriodEnd", reason: "Monitoring period start and end are required." };
  }
  if (end.getTime() < start.getTime()) {
    return { field: "monitoringPeriodEnd", reason: "Period end cannot precede period start." };
  }
  return null;
}
