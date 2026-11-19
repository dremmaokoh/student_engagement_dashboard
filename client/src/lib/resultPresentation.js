const MILLISECONDS_PER_DAY = 86_400_000;

const INDICATOR_KEYS = ["lastActivity", "materialAccess", "assignmentSubmission"];

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

export function formatInlineScore(value) {
  if (!isPresent(value)) {
    return "—";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return String(Math.round(number * 10) / 10);
}

function utcDayValue(value) {
  if (!isPresent(value)) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function loginIntervalDays(result) {
  const storedDays = result?.indicators?.lastActivity?.daysSinceLastActivity;
  if (isPresent(storedDays) && Number.isFinite(Number(storedDays))) {
    return Math.max(0, Number(storedDays));
  }

  const loginDay = utcDayValue(result?.activitySnapshot?.lastActivityAt);
  const periodEndDay = utcDayValue(result?.monitoringPeriodEnd);
  if (loginDay === null || periodEndDay === null) {
    return null;
  }
  return Math.max(0, Math.round((periodEndDay - loginDay) / MILLISECONDS_PER_DAY));
}

export function findApplicableLoginBand(result, days = loginIntervalDays(result)) {
  const bands = result?.configurationSnapshot?.lastActivityBands;
  if (!Array.isArray(bands) || days === null) {
    return null;
  }

  return (
    bands.find((band) => {
      const hasMin = isPresent(band?.minDays);
      const hasMax = isPresent(band?.maxDays);
      const minMatches = !hasMin || days >= Number(band.minDays);
      const maxMatches = !hasMax || days <= Number(band.maxDays);
      return minMatches && maxMatches;
    }) || null
  );
}

export function formatLoginBandLabel(band) {
  if (!band) {
    return null;
  }
  const hasMin = isPresent(band.minDays);
  const hasMax = isPresent(band.maxDays);
  if (hasMin && hasMax) {
    return `${band.minDays}–${band.maxDays} days`;
  }
  if (hasMin) {
    return `${band.minDays} days or more`;
  }
  if (hasMax) {
    return `${band.maxDays} days or fewer`;
  }
  return "Any interval";
}

export function loginEvidence(result) {
  const days = loginIntervalDays(result);
  if (days === null) {
    return null;
  }
  return `Last login: ${days} days before period end.`;
}

export function loginBandExplanation(result) {
  const band = findApplicableLoginBand(result);
  if (!band) {
    return null;
  }
  return `Configured range: ${formatLoginBandLabel(band)} = ${formatInlineScore(band.score)}`;
}

export function weightedScore(result, indicatorKey) {
  const score = result?.indicators?.[indicatorKey]?.score;
  const share = result?.effectiveWeights?.[indicatorKey];
  if (!isPresent(score) || !isPresent(share)) {
    return null;
  }
  const value = Number(score) * Number(share);
  return Number.isFinite(value) ? value : null;
}

export function ratioDetails(result, indicatorKey, countKey, totalKey, noun, verb) {
  const count = result?.activitySnapshot?.[countKey];
  const total = result?.activitySnapshot?.[totalKey];
  const score = result?.indicators?.[indicatorKey]?.score;
  if (!isPresent(count) || !isPresent(total) || !isPresent(score)) {
    return null;
  }
  return {
    evidence: `${count} of ${total} ${noun} ${verb}.`,
    calculation: `${count} ÷ ${total} × 100 = ${formatContribution(score)}`,
  };
}

export function applicableIndicatorKeys(result) {
  return INDICATOR_KEYS.filter((key) => result?.indicators?.[key]?.status === "CALCULATED");
}

export function formatContribution(value) {
  if (!isPresent(value)) {
    return "—";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return number.toFixed(1);
}

export function appliedWeightPercent(result, indicatorKey) {
  const share = result?.effectiveWeights?.[indicatorKey];
  if (!isPresent(share) || !Number.isFinite(Number(share))) {
    return null;
  }
  return `${Math.round(Number(share) * 1000) / 10}%`;
}

export function contributionFormula(result, indicatorKey) {
  if (result?.indicators?.[indicatorKey]?.status !== "CALCULATED") {
    return null;
  }
  const score = result?.indicators?.[indicatorKey]?.score;
  const contribution = weightedScore(result, indicatorKey);
  const percent = appliedWeightPercent(result, indicatorKey);
  if (!isPresent(score) || !Number.isFinite(Number(score)) || contribution === null || percent === null) {
    return null;
  }
  return `${formatContribution(score)} × ${percent} = ${formatContribution(contribution)}`;
}

export function overallContributionFormula(result) {
  const applicable = applicableIndicatorKeys(result);
  if (!applicable.length) {
    return null;
  }
  const contributions = applicable.map((key) => weightedScore(result, key));
  if (contributions.some((value) => value === null)) {
    return null;
  }
  const total = result?.overallScore ?? result?.displayScore;
  if (!isPresent(total) || !Number.isFinite(Number(total))) {
    return null;
  }
  const parts = contributions.map(formatContribution).join(" + ");
  return `Overall Score = ${parts} = ${formatContribution(total)}/100`;
}
