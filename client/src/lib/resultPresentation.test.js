import assert from "node:assert/strict";
import test from "node:test";
import {
  applicableIndicatorKeys,
  appliedWeightPercent,
  contributionFormula,
  findApplicableLoginBand,
  formatContribution,
  loginBandExplanation,
  loginEvidence,
  loginIntervalDays,
  overallContributionFormula,
  ratioDetails,
  weightedScore,
} from "./resultPresentation.js";

const result = {
  monitoringPeriodEnd: "2026-02-22T00:00:00.000Z",
  activitySnapshot: {
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    materialsAccessed: 8,
    materialsAvailable: 10,
    assignmentsSubmitted: 5,
    assignmentsDue: 10,
  },
  indicators: {
    lastActivity: { status: "CALCULATED", score: 80, daysSinceLastActivity: 52 },
    materialAccess: { status: "CALCULATED", score: 80 },
    assignmentSubmission: { status: "CALCULATED", score: 50 },
  },
  configuredWeights: { lastActivity: 0.3, materialAccess: 0.3, assignmentSubmission: 0.4 },
  effectiveWeights: { lastActivity: 0.3, materialAccess: 0.3, assignmentSubmission: 0.4 },
  overallScore: 68,
  configurationSnapshot: {
    lastActivityBands: [
      { minDays: 0, maxDays: 30, score: 100 },
      { minDays: 31, maxDays: 60, score: 80 },
      { minDays: 61, maxDays: null, score: 0 },
    ],
  },
};

test("login interval uses recorded evidence and falls back to snapshot dates", () => {
  assert.equal(loginIntervalDays(result), 52);
  const withoutStoredDays = structuredClone(result);
  delete withoutStoredDays.indicators.lastActivity.daysSinceLastActivity;
  assert.equal(loginIntervalDays(withoutStoredDays), 52);
});

test("applicable login band and explanation come from the saved configuration snapshot", () => {
  assert.deepEqual(findApplicableLoginBand(result), { minDays: 31, maxDays: 60, score: 80 });
  assert.equal(loginEvidence(result), "Last login: 52 days before period end.");
  assert.equal(loginBandExplanation(result), "Configured range: 31–60 days = 80");
});

test("open-ended login bands render without a hard-coded range or /100", () => {
  const openEnded = structuredClone(result);
  openEnded.indicators.lastActivity.daysSinceLastActivity = 75;
  assert.equal(loginBandExplanation(openEnded), "Configured range: 61 days or more = 0");
});

test("ratio evidence uses saved activity counts and existing indicator scores", () => {
  assert.deepEqual(
    ratioDetails(result, "materialAccess", "materialsAccessed", "materialsAvailable", "materials", "accessed"),
    { evidence: "8 of 10 materials accessed.", calculation: "8 ÷ 10 × 100 = 80.0" },
  );
  assert.deepEqual(
    ratioDetails(result, "assignmentSubmission", "assignmentsSubmitted", "assignmentsDue", "assignments", "submitted"),
    { evidence: "5 of 10 assignments submitted.", calculation: "5 ÷ 10 × 100 = 50.0" },
  );
});

test("weighted score uses the saved indicator score and saved weight share", () => {
  assert.equal(weightedScore(result, "materialAccess"), 24);
  assert.deepEqual(applicableIndicatorKeys(result), ["lastActivity", "materialAccess", "assignmentSubmission"]);
});

test("contribution formatting keeps one decimal place for scores and weighted scores", () => {
  assert.equal(formatContribution(25.5), "25.5");
  assert.equal(formatContribution(32), "32.0");
  assert.equal(formatContribution(null), "—");
});

test("applied weight uses normalised effective weights, not configured weights", () => {
  assert.equal(appliedWeightPercent(result, "assignmentSubmission"), "40%");

  const normalised = structuredClone(result);
  normalised.indicators.materialAccess.status = "NOT_APPLICABLE";
  normalised.effectiveWeights = {
    lastActivity: 3 / 7,
    materialAccess: 0,
    assignmentSubmission: 4 / 7,
  };
  assert.equal(appliedWeightPercent(normalised, "lastActivity"), "42.9%");
  assert.equal(appliedWeightPercent(normalised, "assignmentSubmission"), "57.1%");
});

test("contribution formula uses the applied weight for each indicator", () => {
  assert.equal(contributionFormula(result, "materialAccess"), "80.0 × 30% = 24.0");

  const normalised = structuredClone(result);
  normalised.indicators.materialAccess.status = "NOT_APPLICABLE";
  normalised.effectiveWeights = {
    lastActivity: 3 / 7,
    materialAccess: 0,
    assignmentSubmission: 4 / 7,
  };
  assert.equal(contributionFormula(normalised, "lastActivity"), "80.0 × 42.9% = 34.3");
  assert.equal(contributionFormula(normalised, "materialAccess"), null);
});

test("overall formula lists applicable contributions and the stored overall score", () => {
  assert.equal(overallContributionFormula(result), "Overall Score = 24.0 + 24.0 + 20.0 = 68.0/100");

  const normalised = structuredClone(result);
  normalised.indicators.materialAccess.status = "NOT_APPLICABLE";
  normalised.effectiveWeights = {
    lastActivity: 3 / 7,
    materialAccess: 0,
    assignmentSubmission: 4 / 7,
  };
  normalised.overallScore = 80 * (3 / 7) + 50 * (4 / 7);
  assert.equal(overallContributionFormula(normalised), "Overall Score = 34.3 + 28.6 = 62.9/100");

  const noneApplicable = structuredClone(result);
  for (const key of applicableIndicatorKeys(result)) {
    noneApplicable.indicators[key].status = "NOT_APPLICABLE";
  }
  assert.equal(overallContributionFormula(noneApplicable), null);
});
