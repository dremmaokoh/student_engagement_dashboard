import { ScoringValidationError } from "./scoringEngine.js";

export function normalizeWeights(input) {
  const lastActivity = Number(input?.lastActivity);
  const materialAccess = Number(input?.materialAccess);
  const assignmentSubmission = Number(input?.assignmentSubmission);
  if ([lastActivity, materialAccess, assignmentSubmission].some((value) => Number.isNaN(value) || value < 0)) {
    throw new ScoringValidationError("All weights must be non-negative numbers.");
  }
  const sum = lastActivity + materialAccess + assignmentSubmission;
  const weights =
    Math.abs(sum - 100) < 0.01
      ? {
          lastActivity: lastActivity / 100,
          materialAccess: materialAccess / 100,
          assignmentSubmission: assignmentSubmission / 100,
        }
      : { lastActivity, materialAccess, assignmentSubmission };
  const normalisedSum =
    weights.lastActivity + weights.materialAccess + weights.assignmentSubmission;
  if (Math.abs(normalisedSum - 1) > 0.001) {
    throw new ScoringValidationError("Weights must sum to 100% (or 1.0).");
  }
  return weights;
}

export function validateBands(bands) {
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new ScoringValidationError("Last-activity bands are required.");
  }
  const sorted = [...bands].sort((a, b) => a.minDays - b.minDays);
  if (sorted[0].minDays !== 0) {
    throw new ScoringValidationError("Last-activity bands must start at 0 days.");
  }
  for (let index = 0; index < sorted.length; index += 1) {
    const band = sorted[index];
    if (typeof band.score !== "number" || band.score < 0 || band.score > 100) {
      throw new ScoringValidationError("Each band score must be between 0 and 100.");
    }
    if (index < sorted.length - 1) {
      if (band.maxDays === null || band.maxDays === undefined) {
        throw new ScoringValidationError("Only the last last-activity band may be open-ended.");
      }
      if (sorted[index + 1].minDays !== band.maxDays + 1) {
        throw new ScoringValidationError("Last-activity bands must be gap-free and non-overlapping.");
      }
    }
  }
  return sorted;
}

export function validateBoundaries(boundaries) {
  const requiringAttentionMin = Number(boundaries?.requiringAttentionMin);
  const activeMin = Number(boundaries?.activeMin);
  if (
    Number.isNaN(requiringAttentionMin) ||
    Number.isNaN(activeMin) ||
    requiringAttentionMin <= 0 ||
    activeMin <= requiringAttentionMin ||
    activeMin > 100
  ) {
    throw new ScoringValidationError(
      "Classification boundaries must be gap-free: 0 ≤ Inactive < Requiring Attention < Active ≤ 100.",
    );
  }
  return { requiringAttentionMin, activeMin };
}
