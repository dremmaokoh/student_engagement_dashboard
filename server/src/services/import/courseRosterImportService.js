import { parse } from "csv-parse/sync";
import Course from "../../models/Course.js";
import Enrollment from "../../models/Enrollment.js";
import Student from "../../models/Student.js";
import { HttpError } from "../../utils/httpError.js";
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
  const courses = await Course.find({ lecturerId, status: "active" }).sort({ code: 1 });
  const lines = [COURSE_ROSTER_COLUMNS.join(",")];
  for (const course of courses) {
    lines.push(
      [csvCell(course.code), csvCell(course.name), csvCell(""), csvCell(""), csvCell("")].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

const previews = new Map();

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
  previews.set(importId, preview);

  return {
    importId,
    filename: preview.filename,
    summary: preview.summary,
    validRows: validRows.slice(0, 25),
    invalidRows,
  };
}

export async function confirmCourseRosterImport(lecturerId, importId) {
  const preview = previews.get(importId);
  if (!preview || preview.lecturerId !== String(lecturerId)) {
    throw new HttpError(404, "Course import preview was not found or has expired.");
  }
  if (!preview.validRows.length) {
    throw new HttpError(400, "There are no valid rows to import.");
  }

  const courseMap = new Map();
  let coursesCreated = 0;
  let coursesUpdated = 0;
  let studentsCreated = 0;
  let studentsUpdated = 0;
  let enrolmentsCreated = 0;
  let enrolmentsReactivated = 0;
  let enrolmentsSkipped = 0;

  for (const row of preview.validRows) {
    let course = courseMap.get(row.courseCode);
    if (!course) {
      course = await Course.findOne({ lecturerId, code: row.courseCode });
      if (!course) {
        course = await Course.create({
          lecturerId,
          code: row.courseCode,
          name: row.courseName,
          description: "",
          status: "active",
        });
        coursesCreated += 1;
      } else {
        let changed = false;
        if (row.courseName && course.name !== row.courseName) {
          course.name = row.courseName;
          changed = true;
        }
        if (course.status === "archived") {
          course.status = "active";
          changed = true;
        }
        if (changed) {
          await course.save();
          coursesUpdated += 1;
        }
      }
      courseMap.set(row.courseCode, course);
    }

    let student = await Student.findOne({ matriculationNumber: row.studentIdentifier });
    if (!student) {
      student = await Student.create({
        fullName: row.studentName,
        matriculationNumber: row.studentIdentifier,
        ...(row.studentEmail ? { email: row.studentEmail } : {}),
      });
      studentsCreated += 1;
    } else {
      let studentChanged = false;
      if (row.studentName && student.fullName !== row.studentName) {
        student.fullName = row.studentName;
        studentChanged = true;
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
          studentChanged = true;
        }
      }
      if (studentChanged) {
        await student.save();
        studentsUpdated += 1;
      }
    }

    const existing = await Enrollment.findOne({ studentId: student._id, courseId: course._id });
    if (!existing) {
      await Enrollment.create({
        studentId: student._id,
        courseId: course._id,
        status: "active",
        enrolledAt: new Date(),
      });
      enrolmentsCreated += 1;
    } else if (existing.status !== "active") {
      existing.status = "active";
      existing.enrolledAt = new Date();
      await existing.save();
      enrolmentsReactivated += 1;
    } else {
      enrolmentsSkipped += 1;
    }
  }

  previews.delete(importId);

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
      validRows: preview.validRows.length,
      invalidRows: preview.invalidRows.length,
    },
  };
}
