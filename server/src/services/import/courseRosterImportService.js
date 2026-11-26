import { parse } from "csv-parse/sync";
import Course from "../../models/Course.js";
import Enrollment from "../../models/Enrollment.js";
import Student from "../../models/Student.js";
import { assertCsvRowLimit, chunk } from "../../utils/csvLimits.js";
import { invalidateDashboardCache } from "../../utils/dashboardCache.js";
import { HttpError } from "../../utils/httpError.js";
import { createPreviewStore } from "../../utils/previewStore.js";
import { toPublicCourse } from "../../utils/toPublic.js";
import { normalizeStudentEmail } from "../../validators/studentCommunicationValidators.js";

export const COURSE_ROSTER_REQUIRED_COLUMNS = ["courseCode", "courseName", "studentIdentifier", "studentName"];
export const COURSE_ROSTER_COLUMNS = [...COURSE_ROSTER_REQUIRED_COLUMNS, "studentEmail"];

/** @deprecated use COURSE_ROSTER_REQUIRED_COLUMNS */
export const COURSE_ROSTER_COLUMNS_LEGACY = COURSE_ROSTER_REQUIRED_COLUMNS;

/** Static example used in docs/tests; live downloads use {@link buildCourseRosterCsvTemplate}. */
export const COURSE_ROSTER_TEMPLATE = `${COURSE_ROSTER_COLUMNS.join(",")}
CSC101,Introduction to Computing,MVA001,Ada Student,ada.student@example.com
CSC101,Introduction to Computing,MVA002,John Student,john.student@example.com
MTH101,General Mathematics,MVA001,Ada Student,ada.student@example.com
`;

function csvCell(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function buildCourseRosterCsvTemplate(lecturerId) {
  const courses = await Course.find({ lecturerId, status: "active" }).sort({ code: 1 }).lean();
  const lines = [COURSE_ROSTER_COLUMNS.join(",")];
  for (const course of courses) {
    lines.push(
      [csvCell(course.code), csvCell(course.name), csvCell(""), csvCell(""), csvCell("")].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

const previews = createPreviewStore();

function cell(row, key) {
  const value = row[key];
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function studentEmailFromRow(raw) {
  for (const key of Object.keys(raw)) {
    const norm = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (norm === "studentemail" || norm === "email") {
      return cell(raw, key);
    }
  }
  return cell(raw, "studentEmail") || cell(raw, "email");
}

function parseRows(buffer) {
  let records;
  try {
    records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    throw new HttpError(400, "The CSV could not be parsed. Check the header and row formatting.");
  }
  if (!records.length) {
    throw new HttpError(400, "The CSV has no data rows.");
  }
  assertCsvRowLimit(records);
  const headers = Object.keys(records[0] || {});
  for (const required of COURSE_ROSTER_REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new HttpError(400, `Missing required column: ${required}.`);
    }
  }
  return records;
}

export function previewCourseRosterImport(lecturerId, buffer, filename) {
  const records = parseRows(buffer);
  const validRows = [];
  const invalidRows = [];
  const seenPairs = new Set();

  records.forEach((raw, index) => {
    const rowNumber = index + 2;
    const courseCode = cell(raw, "courseCode").toUpperCase();
    const courseName = cell(raw, "courseName");
    const studentIdentifier = cell(raw, "studentIdentifier");
    const studentName = cell(raw, "studentName");
    const studentEmailRaw = studentEmailFromRow(raw);
    const errors = [];

    if (!courseCode) {
      errors.push("courseCode is required.");
    }
    if (!courseName) {
      errors.push("courseName is required.");
    }
    if (!studentIdentifier) {
      errors.push("studentIdentifier is required.");
    }
    if (!studentName) {
      errors.push("studentName is required.");
    }
    let studentEmail = "";
    if (studentEmailRaw) {
      studentEmail = normalizeStudentEmail(studentEmailRaw);
      if (studentEmail === null) {
        errors.push("studentEmail is invalid.");
      }
    }

    const pairKey = `${courseCode}::${studentIdentifier}`;
    if (courseCode && studentIdentifier && seenPairs.has(pairKey)) {
      errors.push("Duplicate course/student pair in this file.");
    }
    if (courseCode && studentIdentifier) {
      seenPairs.add(pairKey);
    }

    if (errors.length) {
      invalidRows.push({ rowNumber, errors, raw });
      return;
    }

    validRows.push({
      rowNumber,
      courseCode,
      courseName,
      studentIdentifier,
      studentName,
      studentEmail: studentEmail || "",
    });
  });

  const courseCodes = [...new Set(validRows.map((row) => row.courseCode))];
  const importId = `roster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const preview = {
    importId,
    lecturerId: String(lecturerId),
    filename: filename || "course-roster.csv",
    createdAt: new Date(),
    validRows,
    invalidRows,
    summary: {
      totalRows: records.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      uniqueCourses: courseCodes.length,
      uniqueStudents: new Set(validRows.map((row) => row.studentIdentifier)).size,
    },
  };
  previews.set(importId, String(lecturerId), preview);

  return {
    importId,
    filename: preview.filename,
    summary: preview.summary,
    validRows: validRows.slice(0, 25),
    invalidRows,
  };
}

const studentKey = (identifier) => String(identifier || "").trim().toUpperCase();
const enrollmentKey = (courseId, studentId) => `${String(courseId)}:${String(studentId)}`;

export async function confirmCourseRosterImport(lecturerId, importId) {
  const ownerKey = String(lecturerId);
  const preview = previews.get(importId, ownerKey);
  if (!preview) {
    throw new HttpError(404, "Preview expired, please upload the file again.");
  }
  if (!preview.validRows.length) {
    throw new HttpError(400, "There are no valid rows to import.");
  }

  const rows = preview.validRows;
  let coursesCreated = 0;
  let coursesUpdated = 0;
  let studentsCreated = 0;
  let studentsUpdated = 0;
  let enrolmentsCreated = 0;
  let enrolmentsReactivated = 0;
  let enrolmentsSkipped = 0;

  // One query for every course on the page, instead of one per row.
  const courseNamesByCode = new Map();
  for (const row of rows) {
    if (!courseNamesByCode.has(row.courseCode)) {
      courseNamesByCode.set(row.courseCode, row.courseName);
    }
  }
  const courseCodes = [...courseNamesByCode.keys()];
  const existingCourses = await Course.find({ lecturerId: ownerKey, code: { $in: courseCodes } })
    .select("code name status")
    .lean();
  const courseMap = new Map(existingCourses.map((course) => [course.code, { ...course }]));

  const courseCreates = [];
  for (const [code, name] of courseNamesByCode) {
    if (!courseMap.has(code)) {
      courseCreates.push({
        lecturerId: ownerKey,
        code,
        name,
        description: "",
        status: "active",
      });
    }
  }
  coursesCreated = courseCreates.length;

  let createdCourseDocs = [];
  if (courseCreates.length) {
    for (const part of chunk(courseCreates)) {
      createdCourseDocs = createdCourseDocs.concat(await Course.insertMany(part, { ordered: false }));
    }
    for (const course of createdCourseDocs) {
      courseMap.set(course.code, {
        _id: course._id,
        code: course.code,
        name: course.name,
        status: course.status,
      });
    }
  }

  const courseUpdateOps = [];
  const existingCourseCodes = new Set(existingCourses.map((course) => course.code));
  for (const code of existingCourseCodes) {
    const course = courseMap.get(code);
    const desiredName = courseNamesByCode.get(code);
    const changes = {};
    if (desiredName && course.name !== desiredName) {
      changes.name = desiredName;
      course.name = desiredName;
    }
    if (course.status === "archived") {
      changes.status = "active";
      course.status = "active";
    }
    if (Object.keys(changes).length) {
      // The old code saved once per course, so count one update per course.
      coursesUpdated += 1;
      courseUpdateOps.push({
        updateOne: { filter: { _id: course._id }, update: { $set: changes } },
      });
    }
  }
  for (const part of chunk(courseUpdateOps)) {
    await Course.bulkWrite(part);
  }

  // One query for all students, then one insert and one bulk update set.
  const studentsByKey = new Map();
  for (const row of rows) {
    const key = studentKey(row.studentIdentifier);
    if (!studentsByKey.has(key)) {
      studentsByKey.set(key, {
        _id: null,
        matriculationNumber: key,
        fullName: row.studentName,
        email: row.studentEmail || "",
      });
    }
  }
  const studentKeys = [...studentsByKey.keys()];
  const existingStudents = await Student.find({ matriculationNumber: { $in: studentKeys } })
    .select("fullName matriculationNumber email")
    .lean();
  for (const student of existingStudents) {
    studentsByKey.set(studentKey(student.matriculationNumber), { ...student });
  }

  const studentCreates = [];
  const studentUpdateOps = [];
  const changedStudentKeys = new Set();
  for (const row of rows) {
    const key = studentKey(row.studentIdentifier);
    const student = studentsByKey.get(key);
    if (!student) continue;
    let changed = false;
    if (row.studentName && student.fullName !== row.studentName) {
      student.fullName = row.studentName;
      changed = true;
    }
    if (row.studentEmail) {
      if (student.email && student.email !== row.studentEmail) {
        throw new HttpError(
          409,
          `Row ${row.rowNumber}: student ${row.studentIdentifier} has a different email on record.`,
        );
      }
      if (!student.email) {
        student.email = row.studentEmail;
        changed = true;
      }
    }
    if (changed) {
      changedStudentKeys.add(key);
    }
  }
  // The old code saved once per changed student, so count one update per student.
  studentsUpdated = changedStudentKeys.size;

  for (const key of studentKeys) {
    const student = studentsByKey.get(key);
    if (!student._id) {
      studentCreates.push({
        fullName: student.fullName,
        matriculationNumber: student.matriculationNumber,
        ...(student.email ? { email: student.email } : {}),
      });
    }
  }
  studentsCreated = studentCreates.length;

  let createdStudentDocs = [];
  if (studentCreates.length) {
    for (const part of chunk(studentCreates)) {
      createdStudentDocs = createdStudentDocs.concat(await Student.insertMany(part, { ordered: false }));
    }
    for (const student of createdStudentDocs) {
      const existing = studentsByKey.get(studentKey(student.matriculationNumber));
      if (existing) {
        existing._id = student._id;
      }
    }
  }

  for (const key of changedStudentKeys) {
    const student = studentsByKey.get(key);
    studentUpdateOps.push({
      updateOne: {
        filter: { matriculationNumber: key },
        update: { $set: { fullName: student.fullName, ...(student.email ? { email: student.email } : {}) } },
      },
    });
  }
  for (const part of chunk(studentUpdateOps)) {
    await Student.bulkWrite(part);
  }

  // One query for current enrolments, then a single upsert bulk write.
  const studentIds = [...studentsByKey.values()].map((student) => student._id).filter(Boolean);
  const courseIds = [...courseMap.values()].map((course) => course._id).filter(Boolean);
  const existingEnrollments = await Enrollment.find({
    courseId: { $in: courseIds },
    studentId: { $in: studentIds },
  })
    .select("courseId studentId status")
    .lean();
  const enrollmentMap = new Map(
    existingEnrollments.map((enrollment) => [
      enrollmentKey(enrollment.courseId, enrollment.studentId),
      { status: enrollment.status },
    ]),
  );

  const enrolledAt = new Date();
  const enrollmentOps = [];
  for (const row of rows) {
    const course = courseMap.get(row.courseCode);
    const student = studentsByKey.get(studentKey(row.studentIdentifier));
    if (!course?._id || !student?._id) continue;
    const key = enrollmentKey(course._id, student._id);
    const existing = enrollmentMap.get(key);
    const op = {
      updateOne: {
        filter: { courseId: course._id, studentId: student._id },
        update: { $set: { status: "active", enrolledAt } },
        upsert: true,
      },
    };
    if (!existing) {
      enrolmentsCreated += 1;
      enrollmentMap.set(key, { status: "active" });
      enrollmentOps.push(op);
    } else if (existing.status !== "active") {
      enrolmentsReactivated += 1;
      existing.status = "active";
      enrollmentOps.push(op);
    } else {
      enrolmentsSkipped += 1;
    }
  }
  for (const part of chunk(enrollmentOps)) {
    await Enrollment.bulkWrite(part);
  }

  previews.delete(importId);
  invalidateDashboardCache(ownerKey);

  return {
    importId,
    filename: preview.filename,
    courses: [...courseMap.values()].map(toPublicCourse),
    counts: {
      coursesCreated,
      coursesUpdated,
      studentsCreated,
      studentsUpdated,
      enrolmentsCreated,
      enrolmentsReactivated,
      enrolmentsSkipped,
      validRows: rows.length,
      invalidRows: preview.invalidRows.length,
    },
  };
}
