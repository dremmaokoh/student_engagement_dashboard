export const WEIGHT_INDICATOR_KEYS = ["lastActivity", "materialAccess", "assignmentSubmission"];

export function toPercentFraction(value) {
  return Math.round(Number(value) * 1000) / 10;
}

export function weightsTotalPercent(lastActivity, materialAccess, assignmentSubmission) {
  const values = [lastActivity, materialAccess, assignmentSubmission].map((value) => Number(value));
  if (values.some((value) => Number.isNaN(value))) {
    return null;
  }
  return Math.round((values[0] + values[1] + values[2]) * 10) / 10;
}

/** Sum only the indicators the lecturer has switched on. */
export function activeWeightsTotalPercent(values, activeIndicators) {
  const selected = WEIGHT_INDICATOR_KEYS.filter((key) => activeIndicators?.[key] !== false);
  if (selected.length === 0) {
    return null;
  }
  const numbers = selected.map((key) => Number(values[key]));
  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) * 10) / 10;
}

export function activeIndicatorCount(activeIndicators) {
  return WEIGHT_INDICATOR_KEYS.filter((key) => activeIndicators?.[key] !== false).length;
}