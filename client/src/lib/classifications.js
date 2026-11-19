/** CSS variables for charts and inline styles — keep aligned with tokens.css */
export const CLASSIFICATION_COLOR_VARS = {
  ACTIVE: "var(--color-classification-active)",
  REQUIRING_ATTENTION: "var(--color-classification-attention)",
  INACTIVE: "var(--color-classification-inactive)",
  INSUFFICIENT_DATA: "var(--color-classification-insufficient)",
};

export const INSUFFICIENT_DATA_HELP =
  "There isn't enough recorded activity data to classify this enrolment for the selected monitoring period. This does not necessarily mean the student is inactive.";

export function classificationLabel(value) {
  return (
    {
      ACTIVE: "Active",
      REQUIRING_ATTENTION: "Requiring Attention",
      INACTIVE: "Inactive",
      INSUFFICIENT_DATA: "Insufficient Data",
    }[value] || value || "—"
  );
}

export function classificationBadgeClass(value) {
  return (
    {
      ACTIVE: "badge badge-ok",
      REQUIRING_ATTENTION: "badge badge-warn",
      INACTIVE: "badge badge-error",
      INSUFFICIENT_DATA: "badge badge-insufficient",
    }[value] || "badge"
  );
}

export function statusBadgeClass(value) {
  return (
    {
      CALCULATED: "badge badge-calculated",
      NOT_APPLICABLE: "badge badge-na",
      INSUFFICIENT_DATA: "badge badge-insufficient",
    }[value] || "badge"
  );
}

export function statusLabel(value) {
  return (
    {
      CALCULATED: "Calculated",
      NOT_APPLICABLE: "Not Applicable",
      INSUFFICIENT_DATA: "Insufficient Data",
    }[value] || value || "—"
  );
}

export const LAST_RECORDED_LOGIN_LABEL = "Last Recorded Login";

export function indicatorLabel(key) {
  return (
    {
      lastActivity: LAST_RECORDED_LOGIN_LABEL,
      materialAccess: "Course material access",
      assignmentSubmission: "Assignment submission",
    }[key] || key
  );
}

export function formatScore(score) {
  if (score === null || score === undefined) {
    return "Not calculated";
  }
  return `${Number(score).toFixed(1)}/100`;
}

export function weightPercent(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}
