/** Presentation-only helpers for the course enrolment modal's student picker. */

export function studentMatchesSearch(student, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [student?.fullName, student?.matriculationNumber, student?.email]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

/** Filters out students already enrolled and applies the search query. Does not mutate input. */
export function filterEnrollableStudents(students, enrolledIds, query = "") {
  return (students || []).filter(
    (student) => !enrolledIds?.has?.(student.id) && studentMatchesSearch(student, query),
  );
}

export function toggleStudentSelection(selectedIds, studentId) {
  const next = new Set(selectedIds || []);
  if (next.has(studentId)) {
    next.delete(studentId);
  } else {
    next.add(studentId);
  }
  return next;
}

export function setStudentsSelected(selectedIds, studentIds, selected) {
  const next = new Set(selectedIds || []);
  for (const studentId of studentIds || []) {
    if (selected) {
      next.add(studentId);
    } else {
      next.delete(studentId);
    }
  }
  return next;
}

/** Returns "none", "some" or "all" for the students currently visible in the picker. */
export function selectionStateForStudents(selectedIds, students) {
  if (!students || students.length === 0) {
    return "none";
  }
  let selectedCount = 0;
  for (const student of students) {
    if (selectedIds?.has?.(student.id)) {
      selectedCount += 1;
    }
  }
  if (selectedCount === 0) {
    return "none";
  }
  if (selectedCount === students.length) {
    return "all";
  }
  return "some";
}
