import mongoose from "mongoose";
import ActivityRecord from "../../models/ActivityRecord.js";
import ClassificationResult from "../../models/ClassificationResult.js";
import Enrollment from "../../models/Enrollment.js";
import ImportBatch from "../../models/ImportBatch.js";
import { invalidateDashboardCache } from "../../utils/dashboardCache.js";
import { HttpError } from "../../utils/httpError.js";
import { paginated, parsePagination } from "../../utils/pagination.js";
import { toPublicStudent } from "../../utils/toPublic.js";
import { getActiveConfig } from "../configService.js";
import { CLASSIFICATIONS, STATUSES } from "../scoring/defaults.js";
import { generateStudentClassification } from "../scoring/scoringEngine.js";
import { logClassificationError, logClassificationStage } from "../../utils/classificationLogger.js";
import { normalizePeriodDate, parseMonitoringPeriod, periodFilter, periodsEquivalent } from "./period.js";

const RUN_NAME_MAX_LENGTH = 120;

function parseRunName(input) {
  const runName = String(input?.runName ?? "").trim();
  if (!runName) {
    throw new HttpError(400, "Run name is required.");
  }
  if (runName.length > RUN_NAME_MAX_LENGTH) {
    throw new HttpError(400, `Run name must be ${RUN_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return runName;
}

function periodDateLabel(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return text.slice(0, 10);
}

async function findLatestConfirmedImport(courseId) {
  return ImportBatch.findOne({
    courseId,
    status: "confirmed",
    importedCount: { $gt: 0 },
  }).sort({ confirmedAt: -1, createdAt: -1 });
}

function periodFromImportBatch(batch) {
  if (!batch?.monitoringPeriodStart || !batch?.monitoringPeriodEnd) {
    return null;
  }
  return {
    monitoringPeriodStart: batch.monitoringPeriodStart,
    monitoringPeriodEnd: batch.monitoringPeriodEnd,
  };
}

function publicImportBatch(batch) {
  if (!batch) {
    return null;
  }
  return {
    id: String(batch._id),
    filename: batch.filename,
    importedCount: batch.importedCount,
    skippedCount: batch.skippedCount,
    rejectedCount: batch.rejectedCount,
    confirmedAt: batch.confirmedAt,
    monitoringPeriodStart: periodDateLabel(batch.monitoringPeriodStart),
    monitoringPeriodEnd: periodDateLabel(batch.monitoringPeriodEnd),
    status: batch.status,
  };
}

function snapshotActivity(record) {
  if (!record) {
    return null;
  }
  return {
    lastActivityAt: record.lastActivityAt,
    materialsAvailable: record.materialsAvailable,
    materialsAccessed: record.materialsAccessed,
    assignmentsDue: record.assignmentsDue,
    assignmentsSubmitted: record.assignmentsSubmitted,
  };
}

function missingActivityClassification() {
  const insufficient = {
    status: STATUSES.INSUFFICIENT_DATA,
    score: null,
    reason: "No imported activity record exists for this student and monitoring period.",
  };
  return {
    indicators: {
      lastActivity: insufficient,
      materialAccess: insufficient,
      assignmentSubmission: insufficient,
    },
    overallScore: null,
    displayScore: null,
    classification: CLASSIFICATIONS.INSUFFICIENT_DATA,
    noClassifiableActivity: false,
    configuredWeights: null,
    effectiveWeights: { lastActivity: 0, materialAccess: 0, assignmentSubmission: 0 },
    reason: "No imported LMS activity is available for this enrolled student in the selected period.",
  };
}

function toPublicResult(result, student) {
  const populatedStudent = result.studentId?.fullName ? result.studentId : student;
  return {
    id: String(result._id),
    studentId: String(result.studentId?._id || result.studentId),
    courseId: String(result.courseId),
    activityRecordId: result.activityRecordId ? String(result.activityRecordId) : null,
    runId: String(result.runId),
    monitoringPeriodStart: result.monitoringPeriodStart,
    monitoringPeriodEnd: result.monitoringPeriodEnd,
    indicators: result.indicators,
    configuredWeights: result.configuredWeights,
    effectiveWeights: result.effectiveWeights,
    overallScore: result.overallScore,
    displayScore: result.displayScore,
    classification: result.classification,
    noClassifiableActivity: result.noClassifiableActivity,
    configurationId: String(result.configurationId),
    configurationVersion: result.configurationVersion,
    configurationSnapshot: result.configurationSnapshot,
    explanation: result.explanation,
    activitySnapshot: result.activitySnapshot,
    generatedAt: result.generatedAt,
    student: populatedStudent ? toPublicStudent(populatedStudent) : undefined,
  };
}

function emptyCounts() {
  return {
    total: 0,
    ACTIVE: 0,
    REQUIRING_ATTENTION: 0,
    INACTIVE: 0,
    INSUFFICIENT_DATA: 0,
  };
}

function countClassifications(results) {
  const counts = emptyCounts();
  counts.total = results.length;
  for (const result of results) {
    if (counts[result.classification] !== undefined) {
      counts[result.classification] += 1;
    }
  }
  return counts;
}

const CLASSIFICATION_FILTER_VALUES = {
  ACTIVE: CLASSIFICATIONS.ACTIVE,
  "REQUIRING ATTENTION": CLASSIFICATIONS.REQUIRING_ATTENTION,
  INACTIVE: CLASSIFICATIONS.INACTIVE,
  "INSUFFICIENT DATA": CLASSIFICATIONS.INSUFFICIENT_DATA,
};

function parseClassificationFilter(value) {
  if (value === undefined || value === null) {
    return [];
  }
  const rawValues = Array.isArray(value) ? value : [value];
  const normalized = rawValues
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim().toUpperCase().replace(/[_-]+/g, " "))
    .filter(Boolean)
    .map((entry) => {
      if (CLASSIFICATION_FILTER_VALUES[entry]) {
        return CLASSIFICATION_FILTER_VALUES[entry];
      }
      return entry.replace(/\s+/g, "_");
    });
  return [...new Set(normalized)];
}

async function latestRun(courseId, period) {
  return ClassificationResult.findOne({ courseId, ...periodFilter(period.monitoringPeriodStart, period.monitoringPeriodEnd) })
    .sort({ generatedAt: -1 })
    .select("runId runName generatedAt configurationVersion monitoringPeriodStart monitoringPeriodEnd");
}

async function runById(courseId, period, runId) {
  if (runId && mongoose.isValidObjectId(runId)) {
    const byRun = await ClassificationResult.findOne({ courseId, runId }).select(
      "runId runName generatedAt configurationVersion monitoringPeriodStart monitoringPeriodEnd",
    );
    if (byRun) {
      return byRun;
    }
  }
  return latestRun(courseId, period);
}

export async function resolveRosterClassificationContext(courseId, query = {}) {
  let requestedPeriod = null;
  if (query.periodStart && query.periodEnd) {
    try {
      requestedPeriod = parseMonitoringPeriod(query);
    } catch {
      requestedPeriod = null;
    }
  }

  const latest = await ClassificationResult.findOne({ courseId })
    .sort({ generatedAt: -1 })
    .select("runId monitoringPeriodStart monitoringPeriodEnd generatedAt");

  if (!latest) {
    return { runId: null, period: requestedPeriod, periodAdjusted: false };
  }

  if (
    requestedPeriod &&
    periodsEquivalent(
      requestedPeriod.monitoringPeriodStart,
      requestedPeriod.monitoringPeriodEnd,
      latest.monitoringPeriodStart,
      latest.monitoringPeriodEnd,
    )
  ) {
    const exact = await ClassificationResult.findOne({
      courseId,
      ...periodFilter(requestedPeriod.monitoringPeriodStart, requestedPeriod.monitoringPeriodEnd),
    })
      .sort({ generatedAt: -1 })
      .select("runId");
    return {
      runId: exact?.runId || latest.runId,
      period: requestedPeriod,
      periodAdjusted: false,
    };
  }

  if (requestedPeriod) {
    const exact = await ClassificationResult.findOne({
      courseId,
      ...periodFilter(requestedPeriod.monitoringPeriodStart, requestedPeriod.monitoringPeriodEnd),
    })
      .sort({ generatedAt: -1 })
      .select("runId monitoringPeriodStart monitoringPeriodEnd");
    if (exact) {
      return {
        runId: exact.runId,
        period: requestedPeriod,
        periodAdjusted: false,
      };
    }
  }

  return {
    runId: latest.runId,
    period: {
      monitoringPeriodStart: latest.monitoringPeriodStart,
      monitoringPeriodEnd: latest.monitoringPeriodEnd,
    },
    periodAdjusted: Boolean(requestedPeriod),
  };
}

async function resolveGenerationPeriod(courseId, requestedPeriod) {
  const requestedCount = await ActivityRecord.countDocuments({
    courseId,
    ...periodFilter(requestedPeriod.monitoringPeriodStart, requestedPeriod.monitoringPeriodEnd),
  });
  if (requestedCount > 0) {
    return requestedPeriod;
  }

  const groups = await ActivityRecord.aggregate([
    { $match: { courseId } },
    {
      $group: {
        _id: {
          monitoringPeriodStart: "$monitoringPeriodStart",
          monitoringPeriodEnd: "$monitoringPeriodEnd",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  if (groups.length > 0 && groups[0]._id?.monitoringPeriodStart && groups[0]._id?.monitoringPeriodEnd) {
    return {
      monitoringPeriodStart: groups[0]._id.monitoringPeriodStart,
      monitoringPeriodEnd: groups[0]._id.monitoringPeriodEnd,
    };
  }

  const recentBatch = await ImportBatch.findOne({
    courseId,
    status: "confirmed",
    importedCount: { $gt: 0 },
  })
    .sort({ confirmedAt: -1, createdAt: -1 });

  if (recentBatch?.monitoringPeriodStart && recentBatch?.monitoringPeriodEnd) {
    const batchPeriod = {
      monitoringPeriodStart: recentBatch.monitoringPeriodStart,
      monitoringPeriodEnd: recentBatch.monitoringPeriodEnd,
    };
    const batchCount = await ActivityRecord.countDocuments({
      courseId,
      ...periodFilter(batchPeriod.monitoringPeriodStart, batchPeriod.monitoringPeriodEnd),
    });
    if (batchCount > 0) {
      return batchPeriod;
    }
  }

  return requestedPeriod;
}

export async function generateClassifications({ course, lecturerId, input }) {
  const logContext = {
    courseId: String(course._id),
    lecturerId: String(lecturerId),
    requestedPeriodStart: input?.monitoringPeriodStart || input?.periodStart || null,
    requestedPeriodEnd: input?.monitoringPeriodEnd || input?.periodEnd || null,
  };
  logClassificationStage("generate.request", logContext);
  const runName = parseRunName(input);

  const latestImportBatch = await findLatestConfirmedImport(course._id);
  if (!latestImportBatch) {
    logClassificationError("generate.no_import", new Error("No confirmed import"), logContext);
    throw new HttpError(
      400,
      "Confirm an activity import with accepted records before generating classifications.",
    );
  }
  const importPeriod = periodFromImportBatch(latestImportBatch);
  const requestedPeriod = importPeriod || parseMonitoringPeriod(input || {});
  const period = await resolveGenerationPeriod(course._id, requestedPeriod);
  const normalizedPeriod = {
    monitoringPeriodStart: normalizePeriodDate(period.monitoringPeriodStart),
    monitoringPeriodEnd: normalizePeriodDate(period.monitoringPeriodEnd),
  };
  logClassificationStage("generate.period_resolved", {
    ...logContext,
    importBatchId: String(latestImportBatch._id),
    importFilename: latestImportBatch.filename,
    monitoringPeriodStart: periodDateLabel(normalizedPeriod.monitoringPeriodStart),
    monitoringPeriodEnd: periodDateLabel(normalizedPeriod.monitoringPeriodEnd),
  });

  const config = await getActiveConfig(course._id, lecturerId);
  logClassificationStage("generate.config_resolved", {
    ...logContext,
    configurationId: String(config.id),
    configurationVersion: config.version,
  });

  const enrollments = await Enrollment.find({ courseId: course._id, status: "active" }).populate("studentId");
  const activityRecords = await ActivityRecord.find({
    courseId: course._id,
    ...periodFilter(normalizedPeriod.monitoringPeriodStart, normalizedPeriod.monitoringPeriodEnd),
  });
  const activityByStudent = new Map(activityRecords.map((record) => [String(record.studentId), record]));

  logClassificationStage("generate.activity_resolved", {
    ...logContext,
    activityRecordCount: activityRecords.length,
    enrolledCount: enrollments.length,
  });

  const runId = new mongoose.Types.ObjectId();
  const generatedAt = new Date();
  const docs = [];

  for (const enrolment of enrollments) {
    const student = enrolment.studentId;
    if (!student) {
      continue;
    }
    const activity = activityByStudent.get(String(student._id));
    const scored = activity
      ? generateStudentClassification(activity, config)
      : missingActivityClassification();

    docs.push({
      studentId: student._id,
      courseId: course._id,
      activityRecordId: activity?._id || null,
      runId,
      runName,
      monitoringPeriodStart: normalizedPeriod.monitoringPeriodStart,
      monitoringPeriodEnd: normalizedPeriod.monitoringPeriodEnd,
      indicators: scored.indicators,
      configuredWeights: scored.configuredWeights || config.weights,
      effectiveWeights: scored.effectiveWeights,
      overallScore: scored.overallScore,
      displayScore: scored.displayScore,
      classification: scored.classification,
      noClassifiableActivity: Boolean(scored.noClassifiableActivity),
      configurationId: config.id,
      configurationVersion: config.version,
      configurationSnapshot: {
        courseConfigurationVersion: config.version,
        globalWeightsVersion: config.globalWeightsVersion,
        weights: config.weights,
        lastActivityBands: config.lastActivityBands,
        classificationBoundaries: config.classificationBoundaries,
        version: config.version,
      },
      explanation: {
        overall: scored.reason,
        formula: "E = (L × W_L) + (M × W_M) + (A × W_A) using effective weights of applicable indicators.",
        indicators: scored.indicators,
        noClassifiableActivity: Boolean(scored.noClassifiableActivity),
      },
      activitySnapshot: snapshotActivity(activity),
      generatedAt,
      generatedBy: lecturerId,
    });
  }

  if (!docs.length) {
    logClassificationError("generate.no_students", new Error("No enrolled students"), logContext);
    throw new HttpError(400, "No enrolled students were found for classification generation.");
  }

  let saved;
  try {
    await ClassificationResult.insertMany(docs, { ordered: true });
    saved = await ClassificationResult.find({ runId }).populate("studentId");
  } catch (error) {
    logClassificationError("generate.persist_failed", error, { ...logContext, runId: String(runId) });
    throw new HttpError(500, "Classification results could not be saved.");
  }

  invalidateDashboardCache(lecturerId);
  const counts = countClassifications(saved);
  logClassificationStage("generate.complete", {
    ...logContext,
    runId: String(runId),
    generatedCount: saved.length,
    counts,
  });

  return {
    runId: String(runId),
    runName,
    generatedAt,
    generatedCount: saved.length,
    configurationVersion: config.version,
    importBatchId: String(latestImportBatch._id),
    period: {
      monitoringPeriodStart: periodDateLabel(normalizedPeriod.monitoringPeriodStart),
      monitoringPeriodEnd: periodDateLabel(normalizedPeriod.monitoringPeriodEnd),
    },
    counts,
    items: saved.map((row) => toPublicResult(row)),
  };
}

async function resultsForPeriod(courseId, period, runId) {
  const run = await runById(courseId, period, runId);
  if (!run) {
    return { run: null, results: [] };
  }
  const results = await ClassificationResult.find({ courseId, runId: run.runId }).populate("studentId");
  return { run, results };
}

function matchesSearch(result, search) {
  if (!search) {
    return true;
  }
  const needle = search.toLowerCase();
  const student = result.studentId;
  return (
    String(student?.fullName || "").toLowerCase().includes(needle) ||
    String(student?.matriculationNumber || "").toLowerCase().includes(needle)
  );
}

function sortResults(results, sortBy, sortDir) {
  const direction = sortDir === "desc" ? -1 : 1;
  const copy = [...results];
  copy.sort((left, right) => {
    let comparison = 0;
    if (sortBy === "overallScore") {
      comparison = (left.overallScore ?? -1) - (right.overallScore ?? -1);
    } else if (sortBy === "classification") {
      comparison = String(left.classification).localeCompare(String(right.classification));
    } else if (sortBy === "matriculationNumber") {
      comparison = String(left.studentId?.matriculationNumber || "").localeCompare(
        String(right.studentId?.matriculationNumber || ""),
      );
    } else {
      comparison = String(left.studentId?.fullName || "").localeCompare(String(right.studentId?.fullName || ""));
    }
    return comparison * direction;
  });
  return copy;
}

async function attachActivityImports(pageRows) {
  const activityIds = pageRows.map((row) => row.activityRecordId).filter(Boolean);
  if (!activityIds.length) {
    return pageRows.map((row) => ({ ...toPublicResult(row), activityImport: null }));
  }
  const records = await ActivityRecord.find({ _id: { $in: activityIds } }).select("_id importBatchId");
  const batchIds = [...new Set(records.map((record) => record.importBatchId).filter(Boolean))];
  const batches = batchIds.length ? await ImportBatch.find({ _id: { $in: batchIds } }) : [];
  const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
  const recordToBatch = new Map(
    records.map((record) => [String(record._id), batchById.get(String(record.importBatchId)) || null]),
  );
  return pageRows.map((row) => {
    const batch = row.activityRecordId ? recordToBatch.get(String(row.activityRecordId)) : null;
    return {
      ...toPublicResult(row),
      activityImport: batch
        ? {
            id: String(batch._id),
            filename: batch.filename,
            confirmedAt: batch.confirmedAt,
            createdAt: batch.createdAt,
          }
        : null,
    };
  });
}

async function resolveImportUsedForRun(courseId, runId) {
  if (!runId) {
    return null;
  }
  const activityIds = await ClassificationResult.distinct("activityRecordId", {
    courseId,
    runId,
    activityRecordId: { $ne: null },
  });
  if (!activityIds.length) {
    return null;
  }
  const records = await ActivityRecord.find({ _id: { $in: activityIds } }).select("importBatchId");
  const batchCounts = new Map();
  for (const record of records) {
    const batchId = String(record.importBatchId);
    batchCounts.set(batchId, (batchCounts.get(batchId) || 0) + 1);
  }
  let primaryBatchId = null;
  let maxCount = 0;
  for (const [batchId, count] of batchCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryBatchId = batchId;
    }
  }
  if (!primaryBatchId) {
    return null;
  }
  const batch = await ImportBatch.findOne({ _id: primaryBatchId, courseId });
  if (!batch) {
    return null;
  }
  const totalStudentsWithActivity = records.length;
  const linkedStudentCount = maxCount;
  const multipleImportSources = batchCounts.size > 1;

  return {
    id: String(batch._id),
    filename: batch.filename,
    importedCount: batch.importedCount,
    skippedCount: batch.skippedCount,
    rejectedCount: batch.rejectedCount,
    confirmedAt: batch.confirmedAt,
    createdAt: batch.createdAt,
    linkedStudentCount,
    totalStudentsWithActivity,
    multipleImportSources,
  };
}

export async function getDashboard({ course, query }) {
  const queryPeriod = parseMonitoringPeriod(query || {});
  const latestImportBatch = await findLatestConfirmedImport(course._id);
  const importPeriod = periodFromImportBatch(latestImportBatch);
  const importEffectivePeriod = importPeriod || queryPeriod;
  const latestRunMeta = await ClassificationResult.findOne({ courseId: course._id })
    .sort({ generatedAt: -1 })
    .select("runId monitoringPeriodStart monitoringPeriodEnd generatedAt");
  const rosterPeriod = latestRunMeta
    ? {
        monitoringPeriodStart: latestRunMeta.monitoringPeriodStart,
        monitoringPeriodEnd: latestRunMeta.monitoringPeriodEnd,
      }
    : importEffectivePeriod;
  let viewPeriod = rosterPeriod;
  if (query.runId && mongoose.isValidObjectId(query.runId)) {
    const selectedRunMeta = await ClassificationResult.findOne({
      courseId: course._id,
      runId: query.runId,
    }).select("monitoringPeriodStart monitoringPeriodEnd");
    if (selectedRunMeta?.monitoringPeriodStart && selectedRunMeta?.monitoringPeriodEnd) {
      viewPeriod = {
        monitoringPeriodStart: selectedRunMeta.monitoringPeriodStart,
        monitoringPeriodEnd: selectedRunMeta.monitoringPeriodEnd,
      };
    }
  }
  const { run, results } = await resultsForPeriod(course._id, viewPeriod, query.runId);
  const enrolledCount = await Enrollment.countDocuments({ courseId: course._id, status: "active" });

  const pagination = parsePagination(query);
  const classifications = parseClassificationFilter(query.classification ?? query.classifications);
  const search = String(query.q || query.search || "").trim();
  const filtered = results.filter((result) => {
    if (classifications.length && !classifications.includes(result.classification)) {
      return false;
    }
    return matchesSearch(result, search);
  });
  const sorted = sortResults(filtered, query.sortBy || "fullName", query.sortDir || "asc");
  const pageItems = sorted.slice(pagination.skip, pagination.skip + pagination.limit);
  const activityImportUsed = run ? await resolveImportUsedForRun(course._id, run.runId) : null;

  return {
    period: rosterPeriod,
    effectivePeriod: {
      monitoringPeriodStart: periodDateLabel(importEffectivePeriod.monitoringPeriodStart),
      monitoringPeriodEnd: periodDateLabel(importEffectivePeriod.monitoringPeriodEnd),
    },
    rosterPeriod: {
      monitoringPeriodStart: periodDateLabel(rosterPeriod.monitoringPeriodStart),
      monitoringPeriodEnd: periodDateLabel(rosterPeriod.monitoringPeriodEnd),
    },
    runId: run ? String(run.runId) : null,
    runName: run?.runName || null,
    generatedAt: run?.generatedAt || null,
    configurationVersion: run?.configurationVersion || null,
    enrolledCount,
    classifiedCount: results.length,
    missingActivityCount: results.filter((result) => !result.activityRecordId).length,
    counts: countClassifications(results),
    latestImport: publicImportBatch(latestImportBatch),
    latestClassification: latestRunMeta
      ? {
          runId: String(latestRunMeta.runId),
          monitoringPeriodStart: periodDateLabel(latestRunMeta.monitoringPeriodStart),
          monitoringPeriodEnd: periodDateLabel(latestRunMeta.monitoringPeriodEnd),
          generatedAt: latestRunMeta.generatedAt,
        }
      : null,
    activityImportUsed,
    results: paginated(
      await attachActivityImports(pageItems),
      sorted.length,
      pagination.page,
      pagination.limit,
    ),
  };
}

export async function listClassificationResults({ course, query }) {
  const dashboard = await getDashboard({ course, query });
  return dashboard.results;
}

function mapRunAggregationRows(runs) {
  return runs.map((run) => ({
    runId: String(run._id),
    runName: run.runName || null,
    generatedAt: run.generatedAt,
    configurationVersion: run.configurationVersion,
    monitoringPeriodStart: run.monitoringPeriodStart,
    monitoringPeriodEnd: run.monitoringPeriodEnd,
    classifiedCount: run.count,
    counts: {
      total: run.count,
      ACTIVE: run.ACTIVE,
      REQUIRING_ATTENTION: run.REQUIRING_ATTENTION,
      INACTIVE: run.INACTIVE,
      INSUFFICIENT_DATA: run.INSUFFICIENT_DATA,
    },
  }));
}

function tryParseMonitoringPeriod(query) {
  const hasStart = String(query?.periodStart || query?.monitoringPeriodStart || "").trim();
  const hasEnd = String(query?.periodEnd || query?.monitoringPeriodEnd || "").trim();
  if (!hasStart || !hasEnd) {
    return null;
  }
  return parseMonitoringPeriod(query || {});
}

function aggregateRunsForCourse(courseId, periodDates) {
  const match = { courseId };
  if (periodDates) {
    Object.assign(match, periodFilter(periodDates.monitoringPeriodStart, periodDates.monitoringPeriodEnd));
  }
  return ClassificationResult.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$runId",
        generatedAt: { $max: "$generatedAt" },
        runName: { $first: "$runName" },
        configurationVersion: { $first: "$configurationVersion" },
        monitoringPeriodStart: { $first: "$monitoringPeriodStart" },
        monitoringPeriodEnd: { $first: "$monitoringPeriodEnd" },
        count: { $sum: 1 },
        ACTIVE: { $sum: { $cond: [{ $eq: ["$classification", "ACTIVE"] }, 1, 0] } },
        REQUIRING_ATTENTION: {
          $sum: { $cond: [{ $eq: ["$classification", "REQUIRING_ATTENTION"] }, 1, 0] },
        },
        INACTIVE: { $sum: { $cond: [{ $eq: ["$classification", "INACTIVE"] }, 1, 0] } },
        INSUFFICIENT_DATA: {
          $sum: { $cond: [{ $eq: ["$classification", "INSUFFICIENT_DATA"] }, 1, 0] },
        },
      },
    },
    { $sort: { generatedAt: -1 } },
  ]);
}

function periodsMatch(left, right) {
  if (!left || !right) {
    return false;
  }
  return periodsEquivalent(
    left.monitoringPeriodStart,
    left.monitoringPeriodEnd,
    right.monitoringPeriodStart,
    right.monitoringPeriodEnd,
  );
}

export async function listClassificationRuns({ course, query }) {
  const scopeAll =
    String(query?.scope || "").toLowerCase() === "all" || String(query?.all || "").toLowerCase() === "true";

  if (scopeAll) {
    const runs = await aggregateRunsForCourse(course._id, null);
    return {
      period: null,
      requestedPeriod: null,
      periodAdjusted: false,
      scope: "all",
      items: mapRunAggregationRows(runs),
    };
  }

  const requestedPeriod = tryParseMonitoringPeriod(query || {});
  if (!requestedPeriod) {
    const runs = await aggregateRunsForCourse(course._id, null);
    return {
      period: null,
      requestedPeriod: null,
      periodAdjusted: false,
      scope: "all",
      items: mapRunAggregationRows(runs),
    };
  }

  let runs = await aggregateRunsForCourse(course._id, requestedPeriod);
  let period = requestedPeriod;
  let periodAdjusted = false;

  if (!runs.length) {
    const latest = await ClassificationResult.findOne({ courseId: course._id })
      .sort({ generatedAt: -1 })
      .select("monitoringPeriodStart monitoringPeriodEnd");
    if (latest?.monitoringPeriodStart && latest?.monitoringPeriodEnd) {
      const resolvedPeriod = {
        monitoringPeriodStart: latest.monitoringPeriodStart,
        monitoringPeriodEnd: latest.monitoringPeriodEnd,
      };
      runs = await aggregateRunsForCourse(course._id, resolvedPeriod);
      if (runs.length) {
        period = resolvedPeriod;
        periodAdjusted = !periodsMatch(requestedPeriod, resolvedPeriod);
      }
    }
  }

  return {
    period,
    requestedPeriod,
    periodAdjusted,
    scope: "period",
    items: mapRunAggregationRows(runs),
  };
}

export async function getClassificationResult({ course, resultId }) {
  if (!mongoose.isValidObjectId(resultId)) {
    throw new HttpError(404, "Classification result was not found.");
  }
  const result = await ClassificationResult.findOne({ _id: resultId, courseId: course._id }).populate("studentId");
  if (!result) {
    throw new HttpError(404, "Classification result was not found.");
  }
  return toPublicResult(result);
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportClassificationResultsCsv({ course, query }) {
  const dashboard = await getDashboard({
    course,
    query: { ...(query || {}), limit: 5000, page: 1 },
  });
  const header = [
    "studentIdentifier",
    "studentName",
    "overallScore",
    "classification",
    "lastActivityScore",
    "lastActivityStatus",
    "materialAccessScore",
    "materialAccessStatus",
    "assignmentSubmissionScore",
    "assignmentSubmissionStatus",
    "configurationVersion",
    "monitoringPeriodStart",
    "monitoringPeriodEnd",
    "runId",
    "generatedAt",
  ];
  const rows = (dashboard.results?.items || []).map((item) => {
    const indicators = item.indicators || {};
    return [
      item.student?.matriculationNumber || "",
      item.student?.fullName || "",
      item.displayScore ?? item.overallScore ?? "",
      item.classification || "",
      indicators.lastActivity?.score ?? "",
      indicators.lastActivity?.status ?? "",
      indicators.materialAccess?.score ?? "",
      indicators.materialAccess?.status ?? "",
      indicators.assignmentSubmission?.score ?? "",
      indicators.assignmentSubmission?.status ?? "",
      item.configurationVersion ?? dashboard.configurationVersion ?? "",
      item.monitoringPeriodStart
        ? String(item.monitoringPeriodStart).slice(0, 10)
        : String(dashboard.period?.monitoringPeriodStart || "").slice(0, 10),
      item.monitoringPeriodEnd
        ? String(item.monitoringPeriodEnd).slice(0, 10)
        : String(dashboard.period?.monitoringPeriodEnd || "").slice(0, 10),
      item.runId || dashboard.runId || "",
      item.generatedAt ? new Date(item.generatedAt).toISOString() : "",
    ]
      .map(csvEscape)
      .join(",");
  });
  return `${header.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}
