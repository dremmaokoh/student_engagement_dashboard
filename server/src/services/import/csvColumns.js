import { DEFAULT_ACTIVE_INDICATORS } from "../scoring/defaults.js";

export const CSV_COLUMNS = [
  "studentIdentifier",
  "studentName",
  "lastLearningActivityAt",
  "learningMaterialsAvailable",
  "learningMaterialsCompleted",
  "assignmentsDue",
  "assignmentsSubmitted",
  "monitoringPeriodStart",
  "monitoringPeriodEnd",
];

const INDICATOR_COLUMNS = {
  lastActivity: ["lastLearningActivityAt"],
  materialAccess: ["learningMaterialsAvailable", "learningMaterialsCompleted"],
  assignmentSubmission: ["assignmentsDue", "assignmentsSubmitted"],
};

/** Columns for the lecturer's current selection. Missing flags mean the indicator is active. */
export function activityColumnsFor(activeIndicators = DEFAULT_ACTIVE_INDICATORS) {
  const active = activeIndicators || DEFAULT_ACTIVE_INDICATORS;
  const columns = ["studentIdentifier", "studentName"];
  if (active.lastActivity !== false) {
    columns.push(...INDICATOR_COLUMNS.lastActivity);
  }
  if (active.materialAccess !== false) {
    columns.push(...INDICATOR_COLUMNS.materialAccess);
  }
  if (active.assignmentSubmission !== false) {
    columns.push(...INDICATOR_COLUMNS.assignmentSubmission);
  }
  columns.push("monitoringPeriodStart", "monitoringPeriodEnd");
  return columns;
}

export const REQUIRED_HEADER = "studentIdentifier";

export function normaliseActivityHeaderKey(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

const COLUMN_BY_KEY = new Map([
  ...CSV_COLUMNS.map((column) => [normaliseActivityHeaderKey(column), column]),
  ["learningitemsrequired", "learningMaterialsAvailable"],
  ["learningitemscompleted", "learningMaterialsCompleted"],
]);

export function canonicaliseActivityHeader(header) {
  const key = normaliseActivityHeaderKey(header);
  return COLUMN_BY_KEY.get(key) || String(header ?? "").trim();
}

export const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}
CSC/2021/001,Ada Student,2026-10-28,10,8,4,3,2026-10-01,2026-10-31
`;