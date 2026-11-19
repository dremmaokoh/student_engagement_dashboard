import {
  calculateAssignmentSubmissionScore,
  calculateEffectiveWeights,
  calculateLastActivityScore,
  calculateMaterialAccessScore,
  calculateOverallScore,
  calendarDaysBetween,
  classifyOverallScore,
  generateStudentClassification,
  ScoringValidationError,
} from "../src/services/scoring/scoringEngine.js";
import { CLASSIFICATIONS, DEFAULT_WEIGHTS, STATUSES } from "../src/services/scoring/defaults.js";

function result(score, status = STATUSES.CALCULATED) {
  return { status, score };
}

describe("scoring engine", () => {
  test("last activity bands", () => {
    const end = new Date("2026-10-31T00:00:00.000Z");
    expect(calculateLastActivityScore(new Date("2026-10-29T00:00:00.000Z"), end).score).toBe(100);
    expect(calculateLastActivityScore(new Date("2026-10-26T00:00:00.000Z"), end).score).toBe(80);
    expect(calculateLastActivityScore(new Date("2026-10-21T00:00:00.000Z"), end).score).toBe(60);
    expect(calculateLastActivityScore(new Date("2026-10-13T00:00:00.000Z"), end).score).toBe(30);
    expect(calculateLastActivityScore(new Date("2026-10-06T00:00:00.000Z"), end).score).toBe(0);
    expect(calculateLastActivityScore(null, end).status).toBe(STATUSES.INSUFFICIENT_DATA);
    expect(calendarDaysBetween(new Date("2026-10-29T00:00:00.000Z"), end)).toBe(2);
    expect(calendarDaysBetween(new Date("2026-10-26T00:00:00.000Z"), end)).toBe(5);
    expect(calendarDaysBetween(new Date("2026-10-21T00:00:00.000Z"), end)).toBe(10);
    expect(calendarDaysBetween(new Date("2026-10-13T00:00:00.000Z"), end)).toBe(18);
    expect(calendarDaysBetween(new Date("2026-10-06T00:00:00.000Z"), end)).toBe(25);
  });

  test("material access scores", () => {
    expect(calculateMaterialAccessScore(8, 10).score).toBe(80);
    expect(calculateMaterialAccessScore(5, 10).score).toBe(50);
    expect(calculateMaterialAccessScore(0, 10).score).toBe(0);
    expect(calculateMaterialAccessScore(0, 0).status).toBe(STATUSES.NOT_APPLICABLE);
    expect(calculateMaterialAccessScore(null, 10).status).toBe(STATUSES.INSUFFICIENT_DATA);
    expect(() => calculateMaterialAccessScore(11, 10)).toThrow(ScoringValidationError);
  });

  test("assignment scores", () => {
    expect(calculateAssignmentSubmissionScore(3, 4).score).toBe(75);
    expect(calculateAssignmentSubmissionScore(0, 4).score).toBe(0);
    expect(calculateAssignmentSubmissionScore(0, 0).status).toBe(STATUSES.NOT_APPLICABLE);
    expect(calculateAssignmentSubmissionScore(null, 4).status).toBe(STATUSES.INSUFFICIENT_DATA);
  });

  test("weighted overall scores and classifications", () => {
    const high = calculateOverallScore({
      lastActivity: result(90),
      materialAccess: result(80),
      assignmentSubmission: result(100),
    });
    expect(high.overallScore).toBe(91);
    expect(high.classification).toBe(CLASSIFICATIONS.ACTIVE);

    const moderate = calculateOverallScore({
      lastActivity: result(60),
      materialAccess: result(50),
      assignmentSubmission: result(60),
    });
    expect(moderate.overallScore).toBe(57);
    expect(moderate.classification).toBe(CLASSIFICATIONS.REQUIRING_ATTENTION);

    const low = calculateOverallScore({
      lastActivity: result(20),
      materialAccess: result(20),
      assignmentSubmission: result(30),
    });
    expect(low.overallScore).toBe(24);
    expect(low.classification).toBe(CLASSIFICATIONS.INACTIVE);

    const max = calculateOverallScore({
      lastActivity: result(100),
      materialAccess: result(100),
      assignmentSubmission: result(100),
    });
    expect(max.overallScore).toBe(100);
    expect(max.classification).toBe(CLASSIFICATIONS.ACTIVE);
  });

  test("classification boundaries", () => {
    expect(classifyOverallScore(39.99)).toBe(CLASSIFICATIONS.INACTIVE);
    expect(classifyOverallScore(40)).toBe(CLASSIFICATIONS.REQUIRING_ATTENTION);
    expect(classifyOverallScore(69.99)).toBe(CLASSIFICATIONS.REQUIRING_ATTENTION);
    expect(classifyOverallScore(70)).toBe(CLASSIFICATIONS.ACTIVE);
    expect(classifyOverallScore(100)).toBe(CLASSIFICATIONS.ACTIVE);
  });

  test("insufficient data and not applicable reweighting", () => {
    const missing = calculateOverallScore({
      lastActivity: result(80),
      materialAccess: result(null, STATUSES.INSUFFICIENT_DATA),
      assignmentSubmission: result(90),
    });
    expect(missing.classification).toBe(CLASSIFICATIONS.INSUFFICIENT_DATA);
    expect(missing.overallScore).toBeNull();

    const na = calculateEffectiveWeights(
      {
        lastActivity: STATUSES.CALCULATED,
        materialAccess: STATUSES.CALCULATED,
        assignmentSubmission: STATUSES.NOT_APPLICABLE,
      },
      DEFAULT_WEIGHTS,
    );
    expect(na.effectiveWeights.lastActivity).toBeCloseTo(0.5);
    expect(na.effectiveWeights.materialAccess).toBeCloseTo(0.5);
    expect(na.effectiveWeights.assignmentSubmission).toBe(0);

    const allNa = calculateOverallScore({
      lastActivity: result(null, STATUSES.NOT_APPLICABLE),
      materialAccess: result(null, STATUSES.NOT_APPLICABLE),
      assignmentSubmission: result(null, STATUSES.NOT_APPLICABLE),
    });
    expect(allNa.classification).toBe(CLASSIFICATIONS.INSUFFICIENT_DATA);
    expect(allNa.noClassifiableActivity).toBe(true);
    expect(allNa.overallScore).toBeNull();
  });

  test("invalid period is rejected", () => {
    expect(() =>
      generateStudentClassification(
        {
          monitoringPeriodStart: "2026-10-31",
          monitoringPeriodEnd: "2026-10-01",
          lastActivityAt: "2026-10-20",
          materialsAccessed: 8,
          materialsAvailable: 10,
          assignmentsSubmitted: 3,
          assignmentsDue: 4,
        },
        {},
      ),
    ).toThrow(/end cannot precede/i);
  });
});
