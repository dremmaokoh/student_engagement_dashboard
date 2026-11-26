import mongoose from "mongoose";
import ClassificationResult from "../../models/ClassificationResult.js";
import ClassificationRun from "../../models/ClassificationRun.js";

function asObjectId(value) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(String(value));
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

export function summarizeClassificationDocs(docs) {
  const counts = emptyCounts();
  counts.total = docs.length;
  let missingActivityCount = 0;
  for (const doc of docs) {
    if (counts[doc.classification] !== undefined) {
      counts[doc.classification] += 1;
    }
    if (!doc.activityRecordId) {
      missingActivityCount += 1;
    }
  }
  return { counts, classifiedCount: docs.length, missingActivityCount };
}

export async function saveRunSummary(summary) {
  await ClassificationRun.updateOne({ runId: summary.runId }, { $set: summary }, { upsert: true });
}

function onlyDuplicateKeys(error) {
  if (error?.code === 11000) {
    return true;
  }
  const writeErrors = error?.writeErrors;
  return Array.isArray(writeErrors) && writeErrors.length > 0 && writeErrors.every((entry) => entry.code === 11000);
}

export async function ensureCourseRunSummaries(courseId) {
  const id = asObjectId(courseId);
  const [storedIds, resultIds] = await Promise.all([
    ClassificationRun.distinct("runId", { courseId: id }),
    ClassificationResult.distinct("runId", { courseId: id }),
  ]);
  const have = new Set(storedIds.map((runId) => String(runId)));
  const missing = resultIds.filter((runId) => !have.has(String(runId)));
  if (!missing.length) {
    return;
  }

  const grouped = await ClassificationResult.aggregate([
    { $match: { courseId: id, runId: { $in: missing } } },
    {
      $group: {
        _id: "$runId",
        generatedAt: { $max: "$generatedAt" },
        runName: { $first: "$runName" },
        configurationVersion: { $first: "$configurationVersion" },
        monitoringPeriodStart: { $first: "$monitoringPeriodStart" },
        monitoringPeriodEnd: { $first: "$monitoringPeriodEnd" },
        count: { $sum: 1 },
        missingActivityCount: {
          $sum: { $cond: [{ $eq: [{ $ifNull: ["$activityRecordId", null] }, null] }, 1, 0] },
        },
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
  ]);

  if (!grouped.length) {
    return;
  }

  const docs = grouped.map((row) => ({
    runId: row._id,
    courseId: id,
    runName: row.runName || null,
    generatedAt: row.generatedAt,
    configurationVersion: row.configurationVersion ?? null,
    monitoringPeriodStart: row.monitoringPeriodStart,
    monitoringPeriodEnd: row.monitoringPeriodEnd,
    classifiedCount: row.count,
    missingActivityCount: row.missingActivityCount,
    counts: {
      total: row.count,
      ACTIVE: row.ACTIVE,
      REQUIRING_ATTENTION: row.REQUIRING_ATTENTION,
      INACTIVE: row.INACTIVE,
      INSUFFICIENT_DATA: row.INSUFFICIENT_DATA,
    },
  }));

  try {
    await ClassificationRun.insertMany(docs, { ordered: false });
  } catch (error) {
    if (!onlyDuplicateKeys(error)) {
      throw error;
    }
  }
}

export function runSummaryToAggregateRow(run) {
  const counts = run.counts || emptyCounts();
  return {
    _id: run.runId,
    generatedAt: run.generatedAt,
    runName: run.runName || null,
    configurationVersion: run.configurationVersion,
    monitoringPeriodStart: run.monitoringPeriodStart,
    monitoringPeriodEnd: run.monitoringPeriodEnd,
    count: counts.total || 0,
    ACTIVE: counts.ACTIVE || 0,
    REQUIRING_ATTENTION: counts.REQUIRING_ATTENTION || 0,
    INACTIVE: counts.INACTIVE || 0,
    INSUFFICIENT_DATA: counts.INSUFFICIENT_DATA || 0,
  };
}
