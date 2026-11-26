export const INDICATOR_KEYS = {
  lastActivity: "lastActivity",
  materialAccess: "materialAccess",
  assignmentSubmission: "assignmentSubmission",
};

export const DEFAULT_WEIGHTS = {
  lastActivity: 0.3,
  materialAccess: 0.3,
  assignmentSubmission: 0.4,
};

export const INDICATOR_KEY_LIST = ["lastActivity", "materialAccess", "assignmentSubmission"];

/** All three indicators participate unless a saved global configuration says otherwise. */
export const DEFAULT_ACTIVE_INDICATORS = {
  lastActivity: true,
  materialAccess: true,
  assignmentSubmission: true,
};

export const DEFAULT_LAST_ACTIVITY_BANDS = [
  { minDays: 0, maxDays: 3, score: 100 },
  { minDays: 4, maxDays: 7, score: 80 },
  { minDays: 8, maxDays: 14, score: 60 },
  { minDays: 15, maxDays: 21, score: 30 },
  { minDays: 22, maxDays: null, score: 0 },
];

export const DEFAULT_BOUNDARIES = {
  requiringAttentionMin: 40,
  activeMin: 70,
};

export const STATUSES = {
  CALCULATED: "CALCULATED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  /** Deliberately left out of the global configuration. Not a data gap and not Not Applicable. */
  DISABLED: "DISABLED",
};

export const CLASSIFICATIONS = {
  ACTIVE: "ACTIVE",
  REQUIRING_ATTENTION: "REQUIRING_ATTENTION",
  INACTIVE: "INACTIVE",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
};

export function displayScore(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value.toFixed(1));
}
