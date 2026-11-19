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