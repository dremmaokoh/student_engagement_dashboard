import assert from "node:assert/strict";
import test from "node:test";
import { activeIndicatorCount, activeWeightsTotalPercent } from "./weights.js";

test("active weight total ignores excluded indicators", () => {
  const values = { lastActivity: 40, materialAccess: 30, assignmentSubmission: 60 };
  const activeIndicators = { lastActivity: true, materialAccess: false, assignmentSubmission: true };
  assert.equal(activeWeightsTotalPercent(values, activeIndicators), 100);
  assert.equal(activeIndicatorCount(activeIndicators), 2);
  assert.equal(
    activeWeightsTotalPercent(values, {
      lastActivity: true,
      materialAccess: true,
      assignmentSubmission: true,
    }),
    130,
  );
  assert.equal(
    activeIndicatorCount({ lastActivity: false, materialAccess: false, assignmentSubmission: true }),
    1,
  );
});
