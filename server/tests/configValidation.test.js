import {
  normalizeWeights,
  validateBands,
  validateBoundaries,
} from "../src/services/scoring/configValidation.js";
import { DEFAULT_LAST_ACTIVITY_BANDS } from "../src/services/scoring/defaults.js";
import { ScoringValidationError } from "../src/services/scoring/scoringEngine.js";

describe("config validation", () => {
  test("accepts percentage weights and fractions", () => {
    expect(normalizeWeights({ lastActivity: 30, materialAccess: 30, assignmentSubmission: 40 })).toEqual({
      lastActivity: 0.3,
      materialAccess: 0.3,
      assignmentSubmission: 0.4,
    });
    expect(normalizeWeights({ lastActivity: 0.25, materialAccess: 0.25, assignmentSubmission: 0.5 })).toEqual({
      lastActivity: 0.25,
      materialAccess: 0.25,
      assignmentSubmission: 0.5,
    });
  });

  test("rejects weights that do not sum to 100%", () => {
    expect(() =>
      normalizeWeights({ lastActivity: 30, materialAccess: 30, assignmentSubmission: 30 }),
    ).toThrow(ScoringValidationError);
  });

  test("rejects gapped last-activity bands", () => {
    expect(() =>
      validateBands([
        { minDays: 0, maxDays: 3, score: 100 },
        { minDays: 8, maxDays: 14, score: 60 },
      ]),
    ).toThrow(/gap-free/i);
    expect(validateBands(DEFAULT_LAST_ACTIVITY_BANDS)).toHaveLength(5);
  });

  test("rejects overlapping or inverted classification boundaries", () => {
    expect(() => validateBoundaries({ requiringAttentionMin: 70, activeMin: 40 })).toThrow(
      ScoringValidationError,
    );
    expect(validateBoundaries({ requiringAttentionMin: 40, activeMin: 70 })).toEqual({
      requiringAttentionMin: 40,
      activeMin: 70,
    });
  });
});
