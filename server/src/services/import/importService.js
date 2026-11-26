import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import Enrollment from "../../models/Enrollment.js";
import ImportBatch from "../../models/ImportBatch.js";
import ActivityRecord from "../../models/ActivityRecord.js";
import { assertCsvRowLimit, chunk } from "../../utils/csvLimits.js";
import { invalidateDashboardCache } from "../../utils/dashboardCache.js";
import { HttpError } from "../../utils/httpError.js";
import { getActiveGlobalWeights } from "../globalWeightsService.js";
import {
  CSV_TEMPLATE,
  activityColumnsFor,
  canonicaliseActivityHeader,
} from "./csvColumns.js";
import { missingOrDate, missingOrInteger, validateCounts, validatePeriod } from "./rowValidation.js";

function assertActivityHeaders(headers, columns) {
  const seen = new Set();
  const normalised = [];
  for (const header of headers) {
    const column = canonicaliseActivityHeader(header);
    if (!column) {
      continue;
    }
    if (seen.has(column)) {
      throw new HttpError(400, `CSV contains duplicate column: ${column}.`);
    }
    seen.add(column);
    normalised.push(column);
  }
  const missing = columns.filter((column) => !normalised.includes(column));
  if (missing.length) {
    throw new HttpError(400, `CSV must include columns: ${missing.join(", ")}.`);
  }
  const unexpected = normalised.filter((column) => !columns.includes(column));
  if (unexpected.length) {
    throw new HttpError(
      400,
      `CSV columns must match the active indicator template. Unexpected: ${unexpected.join(", ")}.`,
    );
  }
  if (normalised.length !== columns.length) {
    throw new HttpError(400, "CSV columns must match the active indicator template.");
  }
}

function fileHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function rowValue(row, key) {
  const target = canonicaliseActivityHeader(key);
  const match = Object.keys(row).find((name) => canonicaliseActivityHeader(name) === target);
  return match ? row[match] : undefined;
}

function rejection(rowNumber, field, reason, context = {}) {
  return { rowNumber, field, reason, ...context };
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

export async function buildCourseActivityCsvTemplate(
  courseId,
  { periodStart = "", periodEnd = "", activeIndicators } = {},
) {
  const columns = activityColumnsFor(activeIndicators);
  const enrollments = await Enrollment.find({ courseId, status: "active" })
    .select("studentId")
    .populate("studentId", "fullName matriculationNumber")
    .lean();
  enrollments.sort((left, right) =>
    String(left.studentId?.fullName || "").localeCompare(String(right.studentId?.fullName || "")),
  );

  const rows = [columns.join(",")];
  const blankActivityCells = columns.slice(2, -2).map(() => "");
  for (const enrolment of enrollments) {
    const student = enrolment.studentId;
    if (!student?.matriculationNumber) {
      continue;
    }
    rows.push(
      [
        csvCell(student.matriculationNumber),
        csvCell(student.fullName),
        ...blankActivityCells,
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
  assertCsvRowLimit(records);

  const weights = await getActiveGlobalWeights(lecturerId);
  const columns = activityColumnsFor(weights.activeIndicators);
  const headers = Object.keys(records[0]).map((header) => header.trim());
  assertActivityHeaders(headers, columns);

  const defaultStart = missingOrDate(periodStart, "monitoringPeriodStart");
  const defaultEnd = missingOrDate(periodEnd, "monitoringPeriodEnd");
  if (defaultStart.error || defaultEnd.error) {
    throw new HttpError(400, "Default monitoring period dates are invalid.");
  }

  const enrollments = await Enrollment.find({ courseId: course._id, status: "active" })
    .select("studentId")
    .populate("studentId", "fullName matriculationNumber")
    .lean();
  const studentsByMatric = new Map();
  for (const enrolment of enrollments) {
    if (enrolment.studentId?.matriculationNumber) {
      studentsByMatric.set(enrolment.studentId.matriculationNumber, enrolment.studentId);
    }
  }

  const errors = [];
  const validRows = [];
  const seenStudents = new Set();
  let duplicateCount = 0;

  records.forEach((raw, index) => {
    const rowNumber = index + 2;
    const identifier = String(rowValue(raw, "studentIdentifier") || "")
      .trim()
      .toUpperCase();
    if (!identifier) {
      errors.push(rejection(rowNumber, "studentIdentifier", "studentIdentifier is required."));
      return;
    }

    const student = studentsByMatric.get(identifier);
    if (!student) {
      errors.push(
        rejection(
          rowNumber,
          "studentIdentifier",
          "Student must exist and be actively enrolled in this course.",
          { studentIdentifier: identifier },
        ),
      );
      return;
    }
    const studentContext = { studentIdentifier: identifier, studentName: student.fullName };

    const lastLearningActivityAt = missingOrDate(rowValue(raw, "lastLearningActivityAt"), "lastLearningActivityAt");
    const learningItemsRequired = missingOrInteger(
      rowValue(raw, "learningMaterialsAvailable"),
      "learningMaterialsAvailable",
    );
    const learningItemsCompleted = missingOrInteger(
      rowValue(raw, "learningMaterialsCompleted"),
      "learningMaterialsCompleted",
    );
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
      lastLearningActivityAt.error,
      learningItemsRequired.error,
      learningItemsCompleted.error,
      assignmentsDue.error,
      assignmentsSubmitted.error,
      periodStartValue.error,
      periodEndValue.error,
      validateCounts(
        learningItemsRequired.value,
        learningItemsCompleted.value,
        assignmentsDue.value,
        assignmentsSubmitted.value,
      ),
      validatePeriod(periodStartValue.value, periodEndValue.value),
    ].filter(Boolean);

    if (fieldErrors.length) {
      errors.push(rejection(rowNumber, fieldErrors[0].field, fieldErrors[0].reason, studentContext));
      return;
    }

    const key = `${student._id}:${periodStartValue.value.toISOString()}:${periodEndValue.value.toISOString()}`;
    if (seenStudents.has(key)) {
      duplicateCount += 1;
      errors.push(
        rejection(
          rowNumber,
          "studentIdentifier",
          "Duplicate student and monitoring period in this file.",
          studentContext,
        ),
      );
      return;
    }
    seenStudents.add(key);

    validRows.push({
      rowNumber,
      studentId: String(student._id),
      studentIdentifier: identifier,
      studentName: student.fullName,
      lastLearningActivityAt: lastLearningActivityAt.value,
      learningItemsRequired: learningItemsRequired.value,
      learningItemsCompleted: learningItemsCompleted.value,
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
    duplicateCount,
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
  }).lean();
  if (!batch) {
    throw new HttpError(404, "Import preview not found.");
  }
  if (batch.status === "confirmed") {
    return toPublicBatch(batch);
  }
  if (!Array.isArray(batch.validRows) || batch.validRows.length === 0) {
    throw new HttpError(400, "There are no valid records to import.");
  }

  let importedCount = 0;
  let skippedCount = 0;

  if (batch.validRows?.length) {
    const firstRow = batch.validRows[0];
    batch.monitoringPeriodStart = firstRow.monitoringPeriodStart;
    batch.monitoringPeriodEnd = firstRow.monitoringPeriodEnd;
  }

  const docs = batch.validRows.map((row) => ({
    studentId: row.studentId,
    courseId: course._id,
    monitoringPeriodStart: row.monitoringPeriodStart,
    monitoringPeriodEnd: row.monitoringPeriodEnd,
    lastLearningActivityAt: row.lastLearningActivityAt,
    learningItemsRequired: row.learningItemsRequired,
    learningItemsCompleted: row.learningItemsCompleted,
    lastActivityAt: row.lastLearningActivityAt,
    materialsAvailable: row.learningItemsRequired,
    materialsAccessed: row.learningItemsCompleted,
    assignmentsDue: row.assignmentsDue,
    assignmentsSubmitted: row.assignmentsSubmitted,
    importBatchId: batch._id,
    sourceType: "csv",
    validation: { rowNumber: row.rowNumber, status: "accepted" },
  }));

  // The unique {courseId, studentId, period} index turns duplicates into
  // skipped rows without a findOne + insert for every CSV row.
  for (const part of chunk(docs)) {
    try {
      const inserted = await ActivityRecord.insertMany(part, { ordered: false });
      importedCount += inserted.length;
    } catch (error) {
      const duplicateOnly =
        error.code === 11000 ||
        (Array.isArray(error.writeErrors) && error.writeErrors.length > 0 && error.writeErrors.every((e) => e.code === 11000));
      if (!duplicateOnly) {
        throw error;
      }
      const insertedCount =
        error.insertedDocs?.length ??
        error.result?.insertedCount ??
        error.result?.result?.nInserted ??
        0;
      importedCount += insertedCount;
      skippedCount += part.length - insertedCount;
    }
  }

  batch.status = "confirmed";
  batch.importedCount = importedCount;
  batch.skippedCount = skippedCount;
  batch.confirmedAt = new Date();
  batch.validRows = [];
  await ImportBatch.updateOne(
    { _id: batch._id },
    {
      $set: {
        status: batch.status,
        importedCount,
        skippedCount,
        confirmedAt: batch.confirmedAt,
        monitoringPeriodStart: batch.monitoringPeriodStart,
        monitoringPeriodEnd: batch.monitoringPeriodEnd,
        validRows: [],
      },
    },
  );
  invalidateDashboardCache(lecturerId);

  return toPublicBatch(batch);
}

export async function listImports(courseId) {
  const batches = await ImportBatch.find({ courseId }).sort({ createdAt: -1 }).limit(50).lean();
  return batches.map((batch) => toPublicBatch(batch));
}

export async function getImport(courseId, lecturerId, importId) {
  const batch = await ImportBatch.findOne({ _id: importId, courseId, lecturerId }).lean();
  if (!batch) {
    throw new HttpError(404, "Import not found.");
  }
  return toPublicBatch(batch, { includePreview: batch.status === "previewed" });
}

function toPublicBatch(batch, { includePreview = false } = {}) {
  const validCount = batch.validCount ?? 0;
  const rejectedCount = batch.rejectedCount ?? 0;
  return {
    id: String(batch._id),
    filename: batch.filename,
    status: batch.status,
    totalCount: validCount + rejectedCount,
    validCount,
    rejectedCount,
    duplicateCount: batch.duplicateCount ?? 0,
    skippedCount: batch.skippedCount ?? 0,
    importedCount: batch.importedCount ?? 0,
    monitoringPeriodStart: batch.monitoringPeriodStart,
    monitoringPeriodEnd: batch.monitoringPeriodEnd,
    createdAt: batch.createdAt,
    confirmedAt: batch.confirmedAt,
    errors: batch.rowErrors ?? [],
    validRows: includePreview ? batch.validRows ?? [] : undefined,
  };
}
