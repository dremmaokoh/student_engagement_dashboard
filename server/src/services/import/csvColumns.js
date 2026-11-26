export const CSV_COLUMNS = [
  "studentIdentifier",
  "studentName",
  "lastActivityAt",
  "materialsAvailable",
  "materialsAccessed",
  "assignmentsDue",
  "assignmentsSubmitted",
  "monitoringPeriodStart",
  "monitoringPeriodEnd",
];

export const REQUIRED_HEADER = "studentIdentifier";

export function normaliseActivityHeaderKey(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

const COLUMN_BY_KEY = new Map(CSV_COLUMNS.map((column) => [normaliseActivityHeaderKey(column), column]));

export function canonicaliseActivityHeader(header) {
  const key = normaliseActivityHeaderKey(header);
  return COLUMN_BY_KEY.get(key) || String(header ?? "").trim();
}

export const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}
CSC/2021/001,Ada Student,2026-10-28,10,8,4,3,2026-10-01,2026-10-31
`;
