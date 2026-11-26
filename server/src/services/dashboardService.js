import mongoose from "mongoose";
import ClassificationResult from "../models/ClassificationResult.js";
import ClassificationRun from "../models/ClassificationRun.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import ImportBatch from "../models/ImportBatch.js";
import { withDashboardCache } from "../utils/dashboardCache.js";
import { HttpError } from "../utils/httpError.js";
import { parsePagination, paginated } from "../utils/pagination.js";
import { toPublicCourse, toPublicStudent } from "../utils/toPublic.js";
import { ensureCourseRunSummaries, runSummaryToAggregateRow } from "./classification/classificationRunStore.js";
import {
  normalizePeriodDate,
  parseMonitoringPeriod,
  periodDayKey,
  periodFilter,
  periodsEquivalent,
} from "./classification/period.js";

function emptyCounts() {
  return {
    total: 0,
    ACTIVE: 0,
    REQUIRING_ATTENTION: 0,
    INACTIVE: 0,
    INSUFFICIENT_DATA: 0,
  };
}

function percent(part, total) {
  if (!total) {
    return null;
  }
  return Math.round((Number(part) / Number(total)) * 1000) / 10;
}

async function lecturerCourses(lecturerId, courseId) {
  const filter = { lecturerId, status: "active" };
  if (courseId && courseId !== "all") {
    if (!mongoose.isValidObjectId(courseId)) {
      throw new HttpError(404, "Course was not found.");
    }
    filter._id = courseId;
  }
  const courses = await Course.find(filter).sort({ code: 1 }).lean();
  if (courseId && courseId !== "all" && courses.length === 0) {
    throw new HttpError(404, "Course was not found.");
  }
  return courses;
}

function resolveDashboardScope(query = {}) {
  const scope = String(query.periodScope || query.scope || "").toLowerCase();
  const preset = String(query.preset || "").toLowerCase();
  if (scope === "latest" || preset === "all" || scope === "all") {
    return { mode: "latest", period: null };
  }
  const startRaw = query.monitoringPeriodStart ?? query.periodStart;
  const endRaw = query.monitoringPeriodEnd ?? query.periodEnd;
  if (!String(startRaw || "").trim() || !String(endRaw || "").trim()) {
    return { mode: "latest", period: null };
  }
  return { mode: "fixed", period: parseMonitoringPeriod(query) };
}

function publicPeriod(period) {
  if (!period) {
    return null;
  }
  return {
    monitoringPeriodStart: periodDayKey(period.monitoringPeriodStart),
    monitoringPeriodEnd: periodDayKey(period.monitoringPeriodEnd),
  };
}

async function latestRunForCourse(courseId, period) {
  await ensureCourseRunSummaries(courseId);
  return ClassificationRun.findOne({
    courseId,
    ...periodFilter(period.monitoringPeriodStart, period.monitoringPeriodEnd),
  })
    .sort({ generatedAt: -1 })
    .select("runId generatedAt configurationVersion monitoringPeriodStart monitoringPeriodEnd runName counts")
    .lean();
}

async function latestRunForCourseOverall(courseId) {
  await ensureCourseRunSummaries(courseId);
  return ClassificationRun.findOne({ courseId })
    .sort({ generatedAt: -1 })
    .select("runId generatedAt configurationVersion monitoringPeriodStart monitoringPeriodEnd runName counts")
    .lean();
}

async function resultsForAttentionQuery(courseId, run, { classificationFilter, focus }) {
  if (!run) {
    return [];
  }
  const filter = { courseId, runId: run.runId };
  if (classificationFilter && CLASSIFICATION_VALUES.includes(classificationFilter)) {
    filter.classification = classificationFilter;
  } else if (focus === "followup") {
    filter.classification = { $in: ["INACTIVE", "REQUIRING_ATTENTION"] };
  }
  return ClassificationResult.find(filter)
    .select("classification displayScore overallScore activitySnapshot generatedAt runId studentId")
    .populate("studentId", "fullName matriculationNumber email createdAt updatedAt")
    .lean();
}

async function enrolledCount(courseId) {
  return Enrollment.countDocuments({ courseId, status: "active" });
}

async function latestImportForCourse(courseId, period) {
  return ImportBatch.findOne({
    courseId,
    status: "confirmed",
    ...periodFilter(period.monitoringPeriodStart, period.monitoringPeriodEnd),
  })
    .sort({ confirmedAt: -1, createdAt: -1 })
    .select("filename importedCount skippedCount rejectedCount confirmedAt createdAt")
    .lean();
}

async function latestImportForCourseOverall(courseId) {
  return ImportBatch.findOne({ courseId, status: "confirmed" })
    .sort({ confirmedAt: -1, createdAt: -1 })
    .select("filename importedCount skippedCount rejectedCount confirmedAt createdAt")
    .lean();
}

async function enrolledUniqueStudentCount(courseIds) {
  if (!courseIds.length) {
    return 0;
  }
  const rows = await Enrollment.aggregate([
    { $match: { courseId: { $in: courseIds }, status: "active" } },
    { $group: { _id: "$studentId" } },
  ]);
  return rows.length;
}

function periodsOverlap(periodStart, periodEnd, rangeStart, rangeEnd) {
  const start = normalizePeriodDate(periodStart)?.getTime();
  const end = normalizePeriodDate(periodEnd)?.getTime();
  const rangeS = normalizePeriodDate(rangeStart)?.getTime();
  const rangeE = normalizePeriodDate(rangeEnd)?.getTime();
  if (start == null || end == null || rangeS == null || rangeE == null) {
    return false;
  }
  return start <= rangeE && end >= rangeS;
}

function periodBucketKey(periodStart, periodEnd) {
  return `${periodDayKey(periodStart)}|${periodDayKey(periodEnd)}`;
}

async function aggregateRunRowsForCourse(courseId) {
  await ensureCourseRunSummaries(courseId);
  const runs = await ClassificationRun.find({ courseId }).sort({ generatedAt: 1 }).lean();
  return runs.map(runSummaryToAggregateRow);
}

function latestRunPerMonitoringPeriod(runRows) {
  const byPeriod = new Map();
  for (const row of runRows) {
    const key = periodBucketKey(row.monitoringPeriodStart, row.monitoringPeriodEnd);
    const existing = byPeriod.get(key);
    if (!existing || new Date(row.generatedAt) > new Date(existing.generatedAt)) {
      byPeriod.set(key, row);
    }
  }
  return byPeriod;
}

function runRowToCounts(row) {
  return {
    total: row.count,
    ACTIVE: row.ACTIVE,
    REQUIRING_ATTENTION: row.REQUIRING_ATTENTION,
    INACTIVE: row.INACTIVE,
    INSUFFICIENT_DATA: row.INSUFFICIENT_DATA,
  };
}

async function collectScopedDataUncached(lecturerId, query) {
  const { mode: periodScope, period } = resolveDashboardScope(query || {});
  const courseFilter = String(query.courseId || "all");
  const courses = await lecturerCourses(lecturerId, courseFilter);

  // All courses are processed in parallel; the three dashboard endpoints then
  // share the result through the short-lived cache below.
  const courseBundles = await Promise.all(
    courses.map(async (course) => {
      const runPromise =
        periodScope === "latest"
          ? latestRunForCourseOverall(course._id)
          : latestRunForCourse(course._id, period);
      const importPromise =
        periodScope === "latest"
          ? latestImportForCourseOverall(course._id)
          : latestImportForCourse(course._id, period);
      const [run, enrolled, latestImport] = await Promise.all([
        runPromise,
        enrolledCount(course._id),
        importPromise,
      ]);
      return {
        course,
        run,
        enrolled,
        latestImport,
        counts: run?.counts || emptyCounts(),
        hasClassification: Boolean(run),
      };
    }),
  );

  return { periodScope, period, courseFilter, courses, courseBundles };
}

function collectScopedData(lecturerId, query) {
  return withDashboardCache(lecturerId, query, () => collectScopedDataUncached(lecturerId, query));
}

export async function getDashboardSummary(lecturerId, query) {
  const { periodScope, period, courseFilter, courses, courseBundles } = await collectScopedData(lecturerId, query);

  const enrolmentCounts = emptyCounts();
  let classifiedEnrolments = 0;
  let coursesWithRuns = 0;

  for (const bundle of courseBundles) {
    classifiedEnrolments += bundle.counts.total || 0;
    for (const classification of ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"]) {
      enrolmentCounts[classification] += bundle.counts[classification] || 0;
    }
    if (bundle.hasClassification) {
      coursesWithRuns += 1;
    }
  }
  enrolmentCounts.total = classifiedEnrolments;

  const enrolledUniqueStudents = await enrolledUniqueStudentCount(courses.map((course) => course._id));

  const totalEnrolments = courseBundles.reduce((sum, bundle) => sum + bundle.enrolled, 0);
  const unclassifiedEnrolments = Math.max(0, totalEnrolments - classifiedEnrolments);

  let latestImport = null;
  for (const bundle of courseBundles) {
    if (!bundle.latestImport) {
      continue;
    }
    const stamp = new Date(bundle.latestImport.confirmedAt || bundle.latestImport.createdAt).getTime();
    if (!latestImport || stamp > latestImport.stamp) {
      latestImport = {
        stamp,
        id: String(bundle.latestImport._id),
        filename: bundle.latestImport.filename,
        importedCount: bundle.latestImport.importedCount,
        skippedCount: bundle.latestImport.skippedCount,
        rejectedCount: bundle.latestImport.rejectedCount,
        confirmedAt: bundle.latestImport.confirmedAt,
        course: toPublicCourse(bundle.course),
      };
    }
  }
  if (latestImport) {
    delete latestImport.stamp;
  }

  let state = "ready";
  if (courses.length === 0) {
    state = "no_courses";
  } else if (totalEnrolments === 0) {
    state = "no_enrolments";
  } else if (coursesWithRuns === 0) {
    state = "no_classifications";
  }

  return {
    aggregationBasis: "course_enrolment_results",
    aggregationLabel: "Course enrolments",
    periodScope,
    uniqueStudentCount: enrolledUniqueStudents,
    enrolledUniqueStudentCount: enrolledUniqueStudents,
    period: publicPeriod(period),
    courseId: courseFilter,
    courseCount: courses.length,
    coursesWithRuns,
    enrolledCount: totalEnrolments,
    classifiedCount: classifiedEnrolments,
    unclassifiedEnrolments,
    classificationCoveragePercent: percent(classifiedEnrolments, totalEnrolments),
    counts: enrolmentCounts,
    percentages: {
      ACTIVE: percent(enrolmentCounts.ACTIVE, classifiedEnrolments),
      REQUIRING_ATTENTION: percent(enrolmentCounts.REQUIRING_ATTENTION, classifiedEnrolments),
      INACTIVE: percent(enrolmentCounts.INACTIVE, classifiedEnrolments),
      INSUFFICIENT_DATA: percent(enrolmentCounts.INSUFFICIENT_DATA, classifiedEnrolments),
    },
    state,
    latestImport,
    courses: courses.map(toPublicCourse),
  };
}

export async function getDashboardCourseComparison(lecturerId, query) {
  const { periodScope, period, courseFilter, courseBundles } = await collectScopedData(lecturerId, query);
  const sortBy = String(query.sortBy || "attention");

  const items = courseBundles.map((bundle) => {
    const classified = bundle.counts.total;
    const unclassified = Math.max(0, bundle.enrolled - classified);
    return {
      course: toPublicCourse(bundle.course),
      enrolledCount: bundle.enrolled,
      classifiedCount: classified,
      unclassifiedEnrolments: unclassified,
      classificationCoveragePercent: percent(classified, bundle.enrolled),
      hasClassification: bundle.hasClassification,
      monitoringPeriodStart: bundle.run ? periodDayKey(bundle.run.monitoringPeriodStart) : null,
      monitoringPeriodEnd: bundle.run ? periodDayKey(bundle.run.monitoringPeriodEnd) : null,
      generatedAt: bundle.run?.generatedAt || null,
      configurationVersion: bundle.run?.configurationVersion || null,
      counts: bundle.hasClassification ? bundle.counts : emptyCounts(),
      percentages: bundle.hasClassification
        ? {
            ACTIVE: percent(bundle.counts.ACTIVE, classified),
            REQUIRING_ATTENTION: percent(bundle.counts.REQUIRING_ATTENTION, classified),
            INACTIVE: percent(bundle.counts.INACTIVE, classified),
            INSUFFICIENT_DATA: percent(bundle.counts.INSUFFICIENT_DATA, classified),
          }
        : {
            ACTIVE: null,
            REQUIRING_ATTENTION: null,
            INACTIVE: null,
            INSUFFICIENT_DATA: null,
          },
      attentionCount: bundle.hasClassification
        ? bundle.counts.REQUIRING_ATTENTION + bundle.counts.INACTIVE
        : 0,
    };
  });

  items.sort((left, right) => {
    if (sortBy === "inactive") {
      return right.counts.INACTIVE - left.counts.INACTIVE || right.attentionCount - left.attentionCount;
    }
    if (sortBy === "active") {
      return (right.percentages.ACTIVE || 0) - (left.percentages.ACTIVE || 0);
    }
    return (
      right.attentionCount - left.attentionCount ||
      right.counts.REQUIRING_ATTENTION - left.counts.REQUIRING_ATTENTION ||
      String(left.course.code).localeCompare(String(right.course.code))
    );
  });

  return {
    aggregationBasis: "course_enrolment_results",
    periodScope,
    period: publicPeriod(period),
    courseId: courseFilter,
    showComparison: courseFilter === "all",
    items,
  };
}

const CLASSIFICATION_RANK = {
  INACTIVE: 0,
  REQUIRING_ATTENTION: 1,
  ACTIVE: 2,
  INSUFFICIENT_DATA: 3,
};

const CLASSIFICATION_VALUES = Object.keys(CLASSIFICATION_RANK);

export async function getDashboardTrend(lecturerId, query) {
  return withDashboardCache(lecturerId, { ...query, _kind: "trend" }, () =>
    buildDashboardTrend(lecturerId, query),
  );
}

async function buildDashboardTrend(lecturerId, query) {
  const { mode: periodScope, period } = resolveDashboardScope(query || {});
  const courseFilter = String(query.courseId || "all");
  const courses = await lecturerCourses(lecturerId, courseFilter);
  const coursesInScope = courses.length;

  const runRowsByCourse = await Promise.all(
    courses.map(async (course) => ({ course, runRows: await aggregateRunRowsForCourse(course._id) })),
  );

  const buckets = new Map();

  for (const { course, runRows } of runRowsByCourse) {
    const perPeriod = latestRunPerMonitoringPeriod(runRows);
    for (const [, row] of perPeriod) {
      if (
        periodScope === "fixed" &&
        !periodsOverlap(
          row.monitoringPeriodStart,
          row.monitoringPeriodEnd,
          period.monitoringPeriodStart,
          period.monitoringPeriodEnd,
        )
      ) {
        continue;
      }
      const key = periodBucketKey(row.monitoringPeriodStart, row.monitoringPeriodEnd);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          monitoringPeriodStart: periodDayKey(row.monitoringPeriodStart),
          monitoringPeriodEnd: periodDayKey(row.monitoringPeriodEnd),
          counts: emptyCounts(),
          coursesIncluded: 0,
          courseRuns: [],
        };
        buckets.set(key, bucket);
      }
      const rowCounts = runRowToCounts(row);
      for (const classification of ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"]) {
        bucket.counts[classification] += rowCounts[classification];
      }
      bucket.counts.total += rowCounts.total;
      bucket.coursesIncluded += 1;
      bucket.courseRuns.push({
        courseId: String(course._id),
        courseCode: course.code,
        runId: String(row._id),
        runName: row.runName || null,
        generatedAt: row.generatedAt,
      });
    }
  }

  const points = [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      coursesInScope,
      isSelectedPeriod:
        periodScope === "fixed" &&
        periodsEquivalent(
          bucket.monitoringPeriodStart,
          bucket.monitoringPeriodEnd,
          period.monitoringPeriodStart,
          period.monitoringPeriodEnd,
        ),
      incompleteCoverage: bucket.coursesIncluded < coursesInScope,
    }))
    .sort(
      (left, right) =>
        new Date(left.monitoringPeriodStart) - new Date(right.monitoringPeriodStart) ||
        new Date(left.monitoringPeriodEnd) - new Date(right.monitoringPeriodEnd),
    );

  return {
    aggregationBasis: "course_enrolment_results",
    periodScope,
    period: publicPeriod(period),
    courseId: courseFilter,
    coursesInScope,
    points,
  };
}

export async function getDashboardAttentionStudents(lecturerId, query) {
  const { periodScope, period, courseFilter, courseBundles } = await collectScopedData(lecturerId, query);
  const pagination = parsePagination(query);
  const focus = String(query.focus || "followup");
  const classificationFilter = String(query.classification || "").trim();
  const search = String(query.q || "").trim().toLowerCase();

  const attentionByCourse = await Promise.all(
    courseBundles.map((bundle) =>
      resultsForAttentionQuery(bundle.course._id, bundle.run, { classificationFilter, focus }),
    ),
  );
  const rows = [];
  for (const [index, bundle] of courseBundles.entries()) {
    for (const result of attentionByCourse[index]) {
      if (classificationFilter && CLASSIFICATION_VALUES.includes(classificationFilter)) {
        if (result.classification !== classificationFilter) {
          continue;
        }
      } else if (focus === "followup") {
        if (!["INACTIVE", "REQUIRING_ATTENTION"].includes(result.classification)) {
          continue;
        }
      }

      if (search) {
        const name = String(result.studentId?.fullName || "").toLowerCase();
        const matric = String(result.studentId?.matriculationNumber || "").toLowerCase();
        if (!name.includes(search) && !matric.includes(search)) {
          continue;
        }
      }

      rows.push({
        id: String(result._id),
        courseId: String(bundle.course._id),
        course: toPublicCourse(bundle.course),
        student: result.studentId ? toPublicStudent(result.studentId) : undefined,
        classification: result.classification,
        displayScore: result.displayScore,
        overallScore: result.overallScore,
        lastLearningActivityAt:
          result.activitySnapshot?.lastLearningActivityAt || result.activitySnapshot?.lastActivityAt || null,
        lastActivityAt:
          result.activitySnapshot?.lastLearningActivityAt || result.activitySnapshot?.lastActivityAt || null,
        generatedAt: result.generatedAt,
        runId: String(result.runId),
      });
    }
  }

  const rank = CLASSIFICATION_RANK;
  rows.sort((left, right) => {
    const byClass = (rank[left.classification] ?? 9) - (rank[right.classification] ?? 9);
    if (byClass !== 0) {
      return byClass;
    }
    const leftTime = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return String(left.student?.fullName || "").localeCompare(String(right.student?.fullName || ""));
  });

  return {
    aggregationBasis: "course_enrolment_results",
    periodScope,
    period: publicPeriod(period),
    courseId: courseFilter,
    results: paginated(rows.slice(pagination.skip, pagination.skip + pagination.limit), rows.length, pagination.page, pagination.limit),
  };
}
