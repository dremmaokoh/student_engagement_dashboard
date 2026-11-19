import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import Enrollment from "../../models/Enrollment.js";
import ImportBatch from "../../models/ImportBatch.js";
import ActivityRecord from "../../models/ActivityRecord.js";
import { HttpError } from "../../utils/httpError.js";
import { CSV_COLUMNS, CSV_TEMPLATE } from "./csvColumns.js";
import { missingOrDate, missingOrInteger, validateCounts, validatePeriod } from "./rowValidation.js";

function assertActivityHeaders(headers) {
  const normalised = headers.map((header) => header.trim()).filter(Boolean);
  const missing = CSV_COLUMNS.filter((column) => !normalised.includes(column));
  if (missing.length) {
    throw new HttpError(400, `CSV must include columns: ${missing.join(", ")}.`);
  }
  const unexpected = normalised.filter((column) => !CSV_COLUMNS.includes(column));
  if (unexpected.length) {
    throw new HttpError(
      400,
      `CSV must contain exactly these nine columns. Unexpected: ${unexpected.join(", ")}.`,
    );
  }
  if (normalised.length !== CSV_COLUMNS.length) {
    throw new HttpError(400, "CSV must contain exactly nine columns as defined by the activity template.");
  }
}

function fileHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function rowValue(row, key) {
  const match = Object.keys(row).find((name) => name.trim() === key);
  return match ? row[match] : undefined;
}

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

export function getCsvTemplate() {
  return CSV_TEMPLATE;
}

export async function buildCourseActivityCsvTemplate(courseId, { periodStart = "", periodEnd = "" } = {}) {
  const enrollments = await Enrollment.find({ courseId, status: "active" }).populate("studentId");
  enrollments.sort((left, right) =>
    String(left.studentId?.fullName || "").localeCompare(String(right.studentId?.fullName || "")),
  );

  const rows = [CSV_COLUMNS.join(",")];
  for (const enrolment of enrollments) {
    const student = enrolment.studentId;
    if (!student?.matriculationNumber) {
      continue;
    }
    rows.push(
      [
        csvCell(student.matriculationNumber),
        csvCell(student.fullName),
        "",
        "",
        "",
        "",
        "",
        csvCell(periodStart),
        csvCell(periodEnd),
      ].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}

export async function previewCsv({ course, lecturerId, file, periodStart, periodEnd }) {
  if (!file?.buffer) {
    throw new HttpError(400, "A CSV file is required.");
  }
  const name = String(file.originalname || "upload.csv").toLowerCase();
  if (!name.endsWith(".csv")) {
    throw new HttpError(400, "Only .csv files are accepted.");
  }

  let records;
  try {
    records = parse(file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    throw new HttpError(400, "The CSV file could not be parsed.");
  }

  if (!records.length) {
    throw new HttpError(400, "The CSV file has no data rows.");
  }

  const headers = Object.keys(records[0]).map((header) => header.trim());
  assertActivityHeaders(headers);

  const defaultStart = missingOrDate(periodStart, "monitoringPeriodStart");
  const defaultEnd = missingOrDate(periodEnd, "monitoringPeriodEnd");
  if (defaultStart.error || defaultEnd.error) {
    throw new HttpError(400, "Default monitoring period dates are invalid.");
  }

  const enrollments = await Enrollment.find({ courseId: course._id, status: "active" }).populate(
    "studentId",
  );
  const studentsByMatric = new Map();
  for (const enrolment of enrollments) {
    if (enrolment.studentId?.matriculationNumber) {
      studentsByMatric.set(enrolment.studentId.matriculationNumber, enrolment.studentId);
    }
  }

  const errors = [];
  const validRows = [];
  const seenStudents = new Set();

  records.forEach((raw, index) => {
    const rowNumber = index + 2;
    const identifier = String(rowValue(raw, "studentIdentifier") || "")
      .trim()
      .toUpperCase();
    if (!identifier) {
      errors.push({ rowNumber, field: "studentIdentifier", reason: "studentIdentifier is required." });
      return;
    }

    const student = studentsByMatric.get(identifier);
    if (!student) {
      errors.push({
        rowNumber,
        field: "studentIdentifier",
        reason: "Student must exist and be actively enrolled in this course.",
      });
      return;
    }

    const lastActivityAt = missingOrDate(rowValue(raw, "lastActivityAt"), "lastActivityAt");
    const materialsAvailable = missingOrInteger(rowValue(raw, "materialsAvailable"), "materialsAvailable");
    const materialsAccessed = missingOrInteger(rowValue(raw, "materialsAccessed"), "materialsAccessed");
    const assignmentsDue = missingOrInteger(rowValue(raw, "assignmentsDue"), "assignmentsDue");
    const assignmentsSubmitted = missingOrInteger(
      rowValue(raw, "assignmentsSubmitted"),
      "assignmentsSubmitted",
    );
    const periodStartValue = missingOrDate(
      rowValue(raw, "monitoringPeriodStart") || periodStart,
      "monitoringPeriodStart",
    );
    const periodEndValue = missingOrDate(
      rowValue(raw, "monitoringPeriodEnd") || periodEnd,
      "monitoringPeriodEnd",
    );

    const fieldErrors = [
      lastActivityAt.error,
      materialsAvailable.error,
      materialsAccessed.error,
      assignmentsDue.error,
      assignmentsSubmitted.error,
      periodStartValue.error,
      periodEndValue.error,
      validateCounts(
        materialsAvailable.value,
        materialsAccessed.value,
        assignmentsDue.value,
        assignmentsSubmitted.value,
      ),
      validatePeriod(periodStartValue.value, periodEndValue.value),
    ].filter(Boolean);

    if (fieldErrors.length) {
      errors.push({ rowNumber, ...fieldErrors[0] });
      return;
    }

    const key = `${student._id}:${periodStartValue.value.toISOString()}:${periodEndValue.value.toISOString()}`;
    if (seenStudents.has(key)) {
      errors.push({
        rowNumber,
        field: "studentIdentifier",
        reason: "Duplicate student and monitoring period in this file.",
      });
      return;
    }
    seenStudents.add(key);

    validRows.push({
      rowNumber,
      studentId: String(student._id),
      studentIdentifier: identifier,
      studentName: student.fullName,
      lastActivityAt: lastActivityAt.value,
      materialsAvailable: materialsAvailable.value,
      materialsAccessed: materialsAccessed.value,
      assignmentsDue: assignmentsDue.value,
      assignmentsSubmitted: assignmentsSubmitted.value,
      monitoringPeriodStart: periodStartValue.value,
      monitoringPeriodEnd: periodEndValue.value,
    });
  });

  const batch = await ImportBatch.create({
    courseId: course._id,
    lecturerId,
    filename: file.originalname,
    fileHash: fileHash(file.buffer),
    sourceType: "csv",
    status: "previewed",
    monitoringPeriodStart: defaultStart.value,
    monitoringPeriodEnd: defaultEnd.value,
    validCount: validRows.length,
    rejectedCount: errors.length,
    skippedCount: 0,
    importedCount: 0,
    rowErrors: errors,
    validRows,
  });

  return toPublicBatch(batch, { includePreview: true });
}

export async function confirmImport({ course, lecturerId, importId }) {
  const batch = await ImportBatch.findOne({
    _id: importId,
    courseId: course._id,
    lecturerId,
  });
  if (!batch) {
    throw new HttpError(404, "Import preview not found.");
  }
  if (batch.status === "confirmed") {
    return toPublicBatch(batch);
  }

  let importedCount = 0;
  let skippedCount = 0;

  if (batch.validRows?.length) {
    const firstRow = batch.validRows[0];
    batch.monitoringPeriodStart = firstRow.monitoringPeriodStart;
    batch.monitoringPeriodEnd = firstRow.monitoringPeriodEnd;
  }

  for (const row of batch.validRows) {
    const existing = await ActivityRecord.findOne({
      courseId: course._id,
      studentId: row.studentId,
      monitoringPeriodStart: row.monitoringPeriodStart,
      monitoringPeriodEnd: row.monitoringPeriodEnd,
    });
    if (existing) {
      skippedCount += 1;
      continue;
    }

    await ActivityRecord.create({
      studentId: row.studentId,
      courseId: course._id,
      monitoringPeriodStart: row.monitoringPeriodStart,
      monitoringPeriodEnd: row.monitoringPeriodEnd,
      lastActivityAt: row.lastActivityAt,
      materialsAvailable: row.materialsAvailable,
      materialsAccessed: row.materialsAccessed,
      assignmentsDue: row.assignmentsDue,
      assignmentsSubmitted: row.assignmentsSubmitted,
      importBatchId: batch._id,
      sourceType: "csv",
      validation: { rowNumber: row.rowNumber, status: "accepted" },
    });
    importedCount += 1;
  }

  batch.status = "confirmed";
  batch.importedCount = importedCount;
  batch.skippedCount = skippedCount;
  batch.confirmedAt = new Date();
  batch.validRows = [];
  await batch.save();

  return toPublicBatch(batch);
}

export async function listImports(courseId) {
  const batches = await ImportBatch.find({ courseId }).sort({ createdAt: -1 }).limit(50);
  return batches.map((batch) => toPublicBatch(batch));
}

export async function getImport(courseId, lecturerId, importId) {
  const batch = await ImportBatch.findOne({ _id: importId, courseId, lecturerId });
  if (!batch) {
    throw new HttpError(404, "Import not found.");
  }
  return toPublicBatch(batch, { includePreview: batch.status === "previewed" });
}

function toPublicBatch(batch, { includePreview = false } = {}) {
  return {
    id: String(batch._id),
    filename: batch.filename,
    status: batch.status,
    validCount: batch.validCount,
    rejectedCount: batch.rejectedCount,
    skippedCount: batch.skippedCount,
    importedCount: batch.importedCount,
    monitoringPeriodStart: batch.monitoringPeriodStart,
    monitoringPeriodEnd: batch.monitoringPeriodEnd,
    createdAt: batch.createdAt,
    confirmedAt: batch.confirmedAt,
    errors: batch.rowErrors,
    validRows: includePreview ? batch.validRows : undefined,
  };
}

export { CSV_COLUMNS };
