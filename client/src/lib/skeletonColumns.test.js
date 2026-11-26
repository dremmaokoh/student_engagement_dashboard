import test from "node:test";
import assert from "node:assert/strict";
import { SKELETON_COLUMNS, skeletonColumns } from "./skeletonColumns.js";

const EXPECTED_COUNTS = {
  legacyCourses: 4,
  courses: 6,
  students: 6,
  roster: 6,
  attention: 6,
  dashboardQueue: 8,
  runHistory: 11,
  results: 5,
  messages: 6,
  courseParticipation: 6,
  settingsCourses: 5,
  importErrors: 4,
  importHistory: 7,
  bands: 4,
  boundaries: 3,
  versionHistory: 6,
  resultBreakdown: 5,
};

test("every skeleton table matches the column count of its real table", () => {
  for (const [name, count] of Object.entries(EXPECTED_COUNTS)) {
    assert.equal(SKELETON_COLUMNS[name].length, count, `${name} skeleton has ${count} columns`);
  }
});

test("serial columns are always present and use the real table class", () => {
  for (const [name, columns] of Object.entries(SKELETON_COLUMNS)) {
    assert.equal(columns[0].className, "col-serial", `${name} first column is the serial column`);
    assert.equal(columns[0].width, "56px", `${name} serial column keeps the real 56px width`);
  }
});

test("an unknown preset returns an empty descriptor list", () => {
  assert.deepEqual(skeletonColumns("missing"), []);
});
