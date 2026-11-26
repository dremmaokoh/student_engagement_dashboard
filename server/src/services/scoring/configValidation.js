import { ScoringValidationError } from "./scoringEngine.js";
import { DEFAULT_ACTIVE_INDICATORS, INDICATOR_KEY_LIST } from "./defaults.js";

export function normalizeActiveIndicators(input) {
  if (input == null) {
    return { ...DEFAULT_ACTIVE_INDICATORS };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ScoringValidationError("activeIndicators must identify each indicator as active or excluded.");
  }
  const active = {};
  for (const key of INDICATOR_KEY_LIST) {
    if (typeof input[key] !== "boolean") {
      throw new ScoringValidationError(`activeIndicators.${key} must be true or false.`);
    }
    active[key] = input[key];
  }
  const activeCount = INDICATOR_KEY_LIST.filter((key) => active[key]).length;
  if (activeCount < 2) {
    throw new ScoringValidationError("At least two indicators must remain active.");
  }
  return active;
}

export function normalizeWeights(input, activeIndicators = DEFAULT_ACTIVE_INDICATORS) {
  const active = normalizeActiveIndicators(activeIndicators);
  const raw = {};
  for (const key of INDICATOR_KEY_LIST) {
    const value = Number(input?.[key]);
    if (!Number.isFinite(value) || value < 0) {
      throw new ScoringValidationError("All weights must be non-negative numbers.");
    }
    raw[key] = value;
  }
  const activeSum = INDICATOR_KEY_LIST.filter((key) => active[key]).reduce((sum, key) => sum + raw[key], 0);
  const scale = Math.abs(activeSum - 100) < 0.01 ? 100 : 1;
  const weights = {};
  for (const key of INDICATOR_KEY_LIST) {
    weights[key] = raw[key] / scale;
  }
  const normalisedActiveSum = INDICATOR_KEY_LIST.filter((key) => active[key]).reduce(
    (sum, key) => sum + weights[key],
    0,
  );
  if (Math.abs(normalisedActiveSum - 1) > 0.001) {
    throw new ScoringValidationError("Active indicator weights must total 100%.");
  }
  return weights;
}

export function normalizeIndicatorConfiguration(input = {}) {
  const activeIndicators = normalizeActiveIndicators(input.activeIndicators);
  const weights = normalizeWeights(input.weights || input, activeIndicators);
  return { weights, activeIndicators };
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
