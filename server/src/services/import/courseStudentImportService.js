import { parse } from "csv-parse/sync";
import Course from "../../models/Course.js";
import Enrollment from "../../models/Enrollment.js";
import Student from "../../models/Student.js";
import { HttpError } from "../../utils/httpError.js";
import { toPublicCourse, toPublicStudent } from "../../utils/toPublic.js";
import { normalizeStudentEmail } from "../../validators/studentCommunicationValidators.js";

export const COURSE_STUDENT_REQUIRED_COLUMNS = ["studentName", "studentIdentifier", "studentEmail"];
export const COURSE_STUDENT_TEMPLATE = `${COURSE_STUDENT_REQUIRED_COLUMNS.join(",")}\n`;

const COLUMN_ALIASES = {
  studentName: ["studentname", "name", "fullname"],
  studentIdentifier: ["studentidentifier", "studentid", "id", "matriculationnumber", "matric"],
  studentEmail: ["studentemail", "email", "mail"],
};

const previews = new Map();

function normalizeHeader(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function cell(raw, canonicalKey) {
  const aliases = new Set(COLUMN_ALIASES[canonicalKey]);
  for (const [key, value] of Object.entries(raw || {})) {
    if (aliases.has(normalizeHeader(key))) {
      return String(value ?? "").trim();
    }
  }
  return "";
}

export function buildCourseStudentCsvTemplate() {
  return `${COURSE_STUDENT_REQUIRED_COLUMNS.join(",")}\n`;
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

  const headers = Object.keys(records[0] || {}).map(normalizeHeader);
  for (const required of COURSE_STUDENT_REQUIRED_COLUMNS) {
    const aliases = COLUMN_ALIASES[required];
    if (!aliases.some((alias) => headers.includes(alias))) {
      throw new HttpError(400, `Missing required column: ${required}.`);
    }
  }
  return records;
}

export async function previewCourseStudentImport(lecturerId, courseId, buffer, filename) {
  const records = parseRows(buffer);
  const pendingRows = [];
  const seenIds = new Map();
  const seenEmails = new Map();

  records.forEach((raw, index) => {
    const rowNumber = index + 2;
    const studentName = cell(raw, "studentName");
    const studentIdentifierRaw = cell(raw, "studentIdentifier");
    const studentIdentifier = studentIdentifierRaw ? studentIdentifierRaw.toUpperCase() : "";
    const studentEmailRaw = cell(raw, "studentEmail");
    const studentEmail = studentEmailRaw ? normalizeStudentEmail(studentEmailRaw) : "";
    const errors = [];

    if (!studentName) {
      errors.push("studentName is required.");
    } else if (studentName.length > 100) {
      errors.push("studentName must be 100 characters or fewer.");
    }

    if (!studentIdentifier) {
      errors.push("studentIdentifier is required.");
    } else if (studentIdentifier.length > 40) {
      errors.push("studentIdentifier must be 40 characters or fewer.");
    }

    if (!studentEmailRaw) {
      errors.push("studentEmail is required.");
    } else if (studentEmail === null) {
      errors.push("studentEmail is invalid.");
    }

    if (studentIdentifier) {
      if (seenIds.has(studentIdentifier)) {
        errors.push(`Duplicate student ID in this file (first used on row ${seenIds.get(studentIdentifier)}).`);
      } else {
        seenIds.set(studentIdentifier, rowNumber);
      }
    }

    if (studentEmail) {
      if (seenEmails.has(studentEmail)) {
        errors.push(`Duplicate email in this file (first used on row ${seenEmails.get(studentEmail)}).`);
      } else {
        seenEmails.set(studentEmail, rowNumber);
      }
    }

    pendingRows.push({ rowNumber, studentName, studentIdentifier, studentEmail, errors, raw });
  });

  const studentIds = [...seenIds.keys()];
  const emails = [...seenEmails.keys()];
  const existingStudents =
    studentIds.length || emails.length
      ? await Student.find({
          $or: [{ matriculationNumber: { $in: studentIds } }, { email: { $in: emails } }],
        })
          .select("fullName matriculationNumber email")
          .lean()
      : [];

  const existingById = new Map(
    existingStudents
      .filter((student) => student.matriculationNumber)
      .map((student) => [String(student.matriculationNumber).toUpperCase(), student]),
  );
  const existingByEmail = new Map(
    existingStudents
      .filter((student) => student.email)
      .map((student) => [String(student.email).toLowerCase(), student]),
  );

  for (const row of pendingRows) {
    const idMatch = existingById.get(row.studentIdentifier);
    if (idMatch) {
      row.errors.push(
        `Student ID already exists in the system${idMatch.fullName ? ` (${idMatch.fullName})` : ""}.`,
      );
    }
    const emailMatch = existingByEmail.get(row.studentEmail);
    if (emailMatch) {
      row.errors.push(
        `Email already exists in the system${emailMatch.matriculationNumber ? ` (${emailMatch.matriculationNumber})` : ""}.`,
      );
    }
  }

  const validRows = [];
  const invalidRows = [];
  for (const row of pendingRows) {
    const { rowNumber, studentName, studentIdentifier, studentEmail, errors, raw } = row;
    if (errors.length) {
      invalidRows.push({ rowNumber, errors, raw });
    } else {
      validRows.push({ rowNumber, studentName, studentIdentifier, studentEmail });
    }
  }

  const importId = `course-students-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const preview = {
    importId,
    lecturerId: String(lecturerId),
    courseId: String(courseId),
    filename: filename || "students.csv",
    createdAt: new Date(),
    validRows,
    invalidRows,
  };
  previews.set(importId, preview);

  return {
    importId,
    filename: preview.filename,
    summary: {
      totalRows: records.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      uniqueStudentIds: new Set(validRows.map((row) => row.studentIdentifier)).size,
      uniqueEmails: new Set(validRows.map((row) => row.studentEmail)).size,
    },
    validRows: validRows.slice(0, 25),
    invalidRows,
  };
}

export async function confirmCourseStudentImport(lecturerId, courseId, importId) {
  const preview = previews.get(importId);
  if (!preview || preview.lecturerId !== String(lecturerId) || preview.courseId !== String(courseId)) {
    throw new HttpError(404, "Student import preview was not found or has expired.");
  }
  previews.delete(importId);

  if (!preview.validRows.length) {
    throw new HttpError(400, "There are no valid rows to import.");
  }

  const course = await Course.findOne({
    _id: courseId,
    lecturerId,
    status: { $ne: "deleted" },
  });
  if (!course) {
    throw new HttpError(404, "Course not found.");
  }

  const studentIds = preview.validRows.map((row) => row.studentIdentifier);
  const emails = preview.validRows.map((row) => row.studentEmail);
  const conflicts = await Student.find({
    $or: [{ matriculationNumber: { $in: studentIds } }, { email: { $in: emails } }],
  })
    .select("matriculationNumber email")
    .lean();

  if (conflicts.length) {
    const first = conflicts[0];
    throw new HttpError(
      409,
      `Student ID or email already exists (${first.matriculationNumber || first.email}). Preview the file again.`,
    );
  }

  const studentDocs = preview.validRows.map((row) => ({
    fullName: row.studentName,
    matriculationNumber: row.studentIdentifier,
    email: row.studentEmail,
  }));

  let createdStudents = [];
  try {
    // Two bulk writes instead of two writes per row (about 1,000 round trips for 499 students).
    createdStudents = await Student.insertMany(studentDocs, { ordered: false });
    await Enrollment.insertMany(
      createdStudents.map((student) => ({
        studentId: student._id,
        courseId: course._id,
        status: "active",
        enrolledAt: new Date(),
      })),
      { ordered: false },
    );
  } catch (err) {
    if (createdStudents.length) {
      await Enrollment.deleteMany({
        studentId: { $in: createdStudents.map((student) => student._id) },
        courseId: course._id,
      });
      await Student.deleteMany({ _id: { $in: createdStudents.map((student) => student._id) } });
    }
    throw new HttpError(409, `Import could not be completed: ${err.message}. Preview the file again.`);
  }

  const students = createdStudents.map(toPublicStudent);

  return {
    importId,
    filename: preview.filename,
    course: toPublicCourse(course),
    counts: {
      studentsCreated: students.length,
      enrolmentsCreated: students.length,
      validRows: preview.validRows.length,
      invalidRows: preview.invalidRows.length,
    },
    students,
  };
}
