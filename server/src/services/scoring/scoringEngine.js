import { HttpError } from "../../utils/httpError.js";
import { CLASSIFICATIONS, DEFAULT_BOUNDARIES, DEFAULT_LAST_ACTIVITY_BANDS, DEFAULT_WEIGHTS, STATUSES, displayScore } from "./defaults.js";

export class ScoringValidationError extends HttpError {
  constructor(message) {
    super(400, message);
    this.name = "ScoringValidationError";
  }
}

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

function utcDay(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    throw new ScoringValidationError("A valid date is required.");
  }
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function calendarDaysBetween(start, end) {
  return Math.round((utcDay(end) - utcDay(start)) / 86400000);
}

export function calculateLastActivityScore(
  lastActivityAt,
  monitoringPeriodEnd,
  bands = DEFAULT_LAST_ACTIVITY_BANDS,
) {
  if (isMissing(lastActivityAt) || isMissing(monitoringPeriodEnd)) {
    return {
      status: STATUSES.INSUFFICIENT_DATA,
      score: null,
      reason: "Last recorded LMS login/activity timestamp is missing.",
    };
  }

  const days = calendarDaysBetween(lastActivityAt, monitoringPeriodEnd);
  const elapsed = Math.max(0, days);
  const band = bands.find((item) => {
    const minOk = elapsed >= item.minDays;
    const maxOk = item.maxDays === null || item.maxDays === undefined || elapsed <= item.maxDays;
    return minOk && maxOk;
  });

  if (!band) {
    throw new ScoringValidationError("Last-activity bands do not cover this number of days.");
  }

  return {
    status: STATUSES.CALCULATED,
    score: band.score,
    daysSinceLastActivity: elapsed,
    reason: `Last recorded LMS login/activity was ${elapsed} calendar day(s) before the end of the monitoring period (UTC).`,
  };
}

export function calculateMaterialAccessScore(materialsAccessed, materialsAvailable) {
  if (materialsAvailable === 0) {
    return {
      status: STATUSES.NOT_APPLICABLE,
      score: null,
      reason: "No relevant materials were available during the monitoring period.",
    };
  }
  if (isMissing(materialsAvailable) || isMissing(materialsAccessed)) {
    return {
      status: STATUSES.INSUFFICIENT_DATA,
      score: null,
      reason: "Course material access logs are incomplete.",
    };
  }
  if (materialsAvailable < 0 || materialsAccessed < 0) {
    throw new ScoringValidationError("Material counts must be non-negative.");
  }
  if (materialsAccessed > materialsAvailable) {
    throw new ScoringValidationError("Accessed materials cannot exceed available materials.");
  }
  return {
    status: STATUSES.CALCULATED,
    score: (materialsAccessed / materialsAvailable) * 100,
    reason: `Course material access is ${materialsAccessed}/${materialsAvailable}.`,
  };
}

export function calculateAssignmentSubmissionScore(assignmentsSubmitted, assignmentsDue) {
  if (assignmentsDue === 0) {
    return {
      status: STATUSES.NOT_APPLICABLE,
      score: null,
      reason: "No eligible assignments were due during the monitoring period.",
    };
  }
  if (isMissing(assignmentsDue) || isMissing(assignmentsSubmitted)) {
    return {
      status: STATUSES.INSUFFICIENT_DATA,
      score: null,
      reason: "Assignment submission records are incomplete.",
    };
  }
  if (assignmentsDue < 0 || assignmentsSubmitted < 0) {
    throw new ScoringValidationError("Assignment counts must be non-negative.");
  }
  if (assignmentsSubmitted > assignmentsDue) {
    throw new ScoringValidationError("Submitted assignments cannot exceed assignments due.");
  }
  return {
    status: STATUSES.CALCULATED,
    score: (assignmentsSubmitted / assignmentsDue) * 100,
    reason: `Assignment submission is ${assignmentsSubmitted}/${assignmentsDue}.`,
  };
}

export function calculateEffectiveWeights(indicatorStatuses, configuredWeights = DEFAULT_WEIGHTS) {
  const applicable = Object.entries(indicatorStatuses).filter(
    ([, status]) => status === STATUSES.CALCULATED,
  );
  const total = applicable.reduce((sum, [key]) => sum + configuredWeights[key], 0);
  const effective = {
    lastActivity: 0,
    materialAccess: 0,
    assignmentSubmission: 0,
  };
  if (total <= 0) {
    return { effectiveWeights: effective, applicableTotal: 0 };
  }
  for (const [key] of applicable) {
    effective[key] = configuredWeights[key] / total;
  }
  return { effectiveWeights: effective, applicableTotal: total };
}

export function classifyOverallScore(overallScore, boundaries = DEFAULT_BOUNDARIES) {
  if (overallScore === null || overallScore === undefined) {
    return CLASSIFICATIONS.INSUFFICIENT_DATA;
  }
  if (overallScore >= boundaries.activeMin) {
    return CLASSIFICATIONS.ACTIVE;
  }
  if (overallScore >= boundaries.requiringAttentionMin) {
    return CLASSIFICATIONS.REQUIRING_ATTENTION;
  }
  return CLASSIFICATIONS.INACTIVE;
}

export function calculateOverallScore(
  indicatorResults,
  configuredWeights = DEFAULT_WEIGHTS,
  boundaries = DEFAULT_BOUNDARIES,
) {
  const statuses = {
    lastActivity: indicatorResults.lastActivity.status,
    materialAccess: indicatorResults.materialAccess.status,
    assignmentSubmission: indicatorResults.assignmentSubmission.status,
  };

  if (Object.values(statuses).every((status) => status === STATUSES.NOT_APPLICABLE)) {
    return {
      overallScore: null,
      displayScore: null,
      classification: CLASSIFICATIONS.INSUFFICIENT_DATA,
      noClassifiableActivity: true,
      configuredWeights,
      effectiveWeights: { lastActivity: 0, materialAccess: 0, assignmentSubmission: 0 },
      reason: "No classifiable activity: all indicators are Not Applicable.",
    };
  }

  if (Object.values(statuses).some((status) => status === STATUSES.INSUFFICIENT_DATA)) {
    const { effectiveWeights } = calculateEffectiveWeights(statuses, configuredWeights);
    return {
      overallScore: null,
      displayScore: null,
      classification: CLASSIFICATIONS.INSUFFICIENT_DATA,
      noClassifiableActivity: false,
      configuredWeights,
      effectiveWeights,
      reason: "A required indicator has Insufficient Data, so a final score is not calculated.",
    };
  }

  const { effectiveWeights } = calculateEffectiveWeights(statuses, configuredWeights);
  const overallScore =
    (indicatorResults.lastActivity.status === STATUSES.CALCULATED
      ? indicatorResults.lastActivity.score * effectiveWeights.lastActivity
      : 0) +
    (indicatorResults.materialAccess.status === STATUSES.CALCULATED
      ? indicatorResults.materialAccess.score * effectiveWeights.materialAccess
      : 0) +
    (indicatorResults.assignmentSubmission.status === STATUSES.CALCULATED
      ? indicatorResults.assignmentSubmission.score * effectiveWeights.assignmentSubmission
      : 0);

  return {
    overallScore,
    displayScore: displayScore(overallScore),
    classification: classifyOverallScore(overallScore, boundaries),
    noClassifiableActivity: false,
    configuredWeights,
    effectiveWeights,
    reason: "Weighted overall score from applicable indicators.",
  };
}

export function generateStudentClassification(activityRecord, config) {
  const start = activityRecord.monitoringPeriodStart;
  const end = activityRecord.monitoringPeriodEnd;
  if (isMissing(start) || isMissing(end)) {
    throw new ScoringValidationError("Monitoring period start and end are required.");
  }
  if (utcDay(end) < utcDay(start)) {
    throw new ScoringValidationError("Period end cannot precede period start.");
  }

  const weights = config?.weights || DEFAULT_WEIGHTS;
  const bands = config?.lastActivityBands || DEFAULT_LAST_ACTIVITY_BANDS;
  const boundaries = config?.classificationBoundaries || DEFAULT_BOUNDARIES;

  const lastActivity = calculateLastActivityScore(
    activityRecord.lastActivityAt,
    end,
    bands,
  );
  const materialAccess = calculateMaterialAccessScore(
    activityRecord.materialsAccessed,
    activityRecord.materialsAvailable,
  );
  const assignmentSubmission = calculateAssignmentSubmissionScore(
    activityRecord.assignmentsSubmitted,
    activityRecord.assignmentsDue,
  );

  const overall = calculateOverallScore(
    { lastActivity, materialAccess, assignmentSubmission },
    weights,
    boundaries,
  );

  return {
    indicators: { lastActivity, materialAccess, assignmentSubmission },
    ...overall,
  };
}
