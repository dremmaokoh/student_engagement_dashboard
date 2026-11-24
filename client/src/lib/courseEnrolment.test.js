import assert from "node:assert/strict";
import test from "node:test";
import {
  filterEnrollableStudents,
  selectionStateForStudents,
  setStudentsSelected,
  studentMatchesSearch,
  toggleStudentSelection,
} from "./courseEnrolment.js";

const students = [
  { id: "1", fullName: "Amina Ali", matriculationNumber: "ST001", email: "amina@example.edu" },
  { id: "2", fullName: "Ben Carter", matriculationNumber: "ST002", email: "ben@example.edu" },
  { id: "3", fullName: "Chloe Dana", matriculationNumber: "ST003", email: "chloe@example.edu" },
];

test("student search matches name, student ID and email case-insensitively", () => {
  assert.equal(studentMatchesSearch(students[0], ""), true);
  assert.equal(studentMatchesSearch(students[0], "  AMINA "), true);
  assert.equal(studentMatchesSearch(students[0], "st001"), true);
  assert.equal(studentMatchesSearch(students[1], "example.edu"), true);
  assert.equal(studentMatchesSearch(students[1], "chloe"), false);
});

test("enrollable students exclude existing enrolments before search", () => {
  const result = filterEnrollableStudents(students, new Set(["2"]), "ST00");
  assert.deepEqual(
    result.map((student) => student.id),
    ["1", "3"],
  );
});

test("selection helpers add, remove and bulk-select without mutating the original set", () => {
  const original = new Set(["1"]);
  const added = toggleStudentSelection(original, "2");
  assert.deepEqual([...added].sort(), ["1", "2"]);
  assert.deepEqual([...original], ["1"]);

  const removed = toggleStudentSelection(added, "1");
  assert.deepEqual([...removed], ["2"]);

  const all = setStudentsSelected(removed, ["1", "2", "3"], true);
  assert.deepEqual([...all].sort(), ["1", "2", "3"]);
  assert.deepEqual([...removed], ["2"]);

  const none = setStudentsSelected(all, ["1", "2", "3"], false);
  assert.deepEqual([...none], []);
});

test("visible selection state distinguishes none, some and all", () => {
  assert.equal(selectionStateForStudents(new Set(), students), "none");
  assert.equal(selectionStateForStudents(new Set(["1", "2", "3"]), students), "all");
  assert.equal(selectionStateForStudents(new Set(["1", "3"]), students), "some");
  assert.equal(selectionStateForStudents(new Set(["1"]), []), "none");
});
