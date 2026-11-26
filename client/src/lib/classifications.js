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
      DISABLED: "Excluded",
    }[value] || value || "—"
  );
}

export const LEARNING_ACTIVITY_RECENCY_LABEL = "Learning Activity Recency";
export const LEARNING_MATERIAL_COMPLETION_LABEL = "Learning Material Completion";
export const ASSIGNMENT_SUBMISSION_LABEL = "Assignment Submission";

/** @deprecated Use LEARNING_ACTIVITY_RECENCY_LABEL */
export const LAST_RECORDED_LOGIN_LABEL = LEARNING_ACTIVITY_RECENCY_LABEL;

export const INDICATOR_HELP = {
  lastActivity:
    "Learning Activity Recency measures how recently a student performed a qualifying learning interaction within a course. Qualifying interactions include lecture viewing, instructional video watching, quiz attempts, discussion forum participation and course survey participation. The system uses the timestamp of the student's most recent qualifying activity. Simply logging into the LMS does not count.",
  materialAccess:
    "Measures the percentage of required learning materials or learning activities that the student has completed according to the LMS completion records. Simply opening, viewing or downloading a material does not mean it has been completed.",
  assignmentSubmission:
    "Measures the percentage of eligible assignments submitted by the student during the monitoring period.",
};

export function indicatorLabel(key) {
  return (
    {
      lastActivity: LEARNING_ACTIVITY_RECENCY_LABEL,
      materialAccess: LEARNING_MATERIAL_COMPLETION_LABEL,
      assignmentSubmission: ASSIGNMENT_SUBMISSION_LABEL,
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
