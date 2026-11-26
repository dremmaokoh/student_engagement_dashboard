import ClassificationResult from "../models/ClassificationResult.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { invalidateDashboardCache } from "../utils/dashboardCache.js";
import { HttpError } from "../utils/httpError.js";
import { paginated, parsePagination } from "../utils/pagination.js";
import { toPublicCourse } from "../utils/toPublic.js";

function emptyCounts() {
  return {
    total: 0,
    ACTIVE: 0,
    REQUIRING_ATTENTION: 0,
    INACTIVE: 0,
    INSUFFICIENT_DATA: 0,
  };
}

export async function listCourses(lecturerId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { lecturerId };
  if (query.includeArchived !== "true") {
    filter.status = "active";
  }
  if (query.q) {
    const q = String(query.q).trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { code: { $regex: q, $options: "i" } },
    ];
  }

  const courseQuery = Course.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const totalQuery = Course.countDocuments(filter);

  const [items, total] = await Promise.all([courseQuery, totalQuery]);
  const courseIds = items.map((course) => course._id);

  const [enrollmentRows, latestRows] = await Promise.all([
    Enrollment.aggregate([
      { $match: { courseId: { $in: courseIds }, status: "active" } },
      { $group: { _id: "$courseId", n: { $sum: 1 } } },
    ]),
    ClassificationResult.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $sort: { generatedAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$courseId",
          runId: { $first: "$runId" },
          generatedAt: { $first: "$generatedAt" },
          monitoringPeriodStart: { $first: "$monitoringPeriodStart" },
          monitoringPeriodEnd: { $first: "$monitoringPeriodEnd" },
        },
      },
    ]),
  ]);

  const enrolledByCourse = new Map(enrollmentRows.map((row) => [String(row._id), row.n]));
  const latestByCourse = new Map(latestRows.map((row) => [String(row._id), row]));
  const latestRunIds = latestRows.map((row) => row.runId).filter(Boolean);

  const countRows = latestRunIds.length
    ? await ClassificationResult.aggregate([
        { $match: { runId: { $in: latestRunIds } } },
        {
          $group: {
            _id: { courseId: "$courseId", classification: "$classification" },
            n: { $sum: 1 },
          },
        },
      ])
    : [];

  const countsByCourse = new Map();
  for (const row of countRows) {
    const courseId = String(row._id.courseId);
    if (!countsByCourse.has(courseId)) {
      countsByCourse.set(courseId, emptyCounts());
    }
    const counts = countsByCourse.get(courseId);
    counts.total += row.n;
    if (counts[row._id.classification] !== undefined) {
      counts[row._id.classification] += row.n;
    }
  }

  const enriched = items.map((course) => {
    const courseId = String(course._id);
    const latest = latestByCourse.get(courseId);
    const counts = latest ? countsByCourse.get(courseId) || emptyCounts() : null;
    return {
      ...toPublicCourse(course),
      enrolledCount: enrolledByCourse.get(courseId) || 0,
      latestClassificationAt: latest?.generatedAt || null,
      latestPeriodStart: latest?.monitoringPeriodStart || null,
      latestPeriodEnd: latest?.monitoringPeriodEnd || null,
      counts,
    };
  });

  return paginated(enriched, total, page, limit);
}

export async function createCourse(lecturerId, input) {
  try {
    const course = await Course.create({ ...input, lecturerId, status: "active" });
    invalidateDashboardCache(lecturerId);
    return toPublicCourse(course);
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(409, "You already have a course with this code.");
    }
    throw error;
  }
}

export async function updateCourse(course, input) {
  Object.assign(course, input);
  try {
    await course.save();
    invalidateDashboardCache(course.lecturerId);
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(409, "You already have a course with this code.");
    }
    throw error;
  }
  return toPublicCourse(course);
}

export async function archiveCourse(course) {
  const enrolmentCount = await Enrollment.countDocuments({ courseId: course._id });
  course.status = "archived";
  await course.save();
  invalidateDashboardCache(course.lecturerId);
  return {
    course: toPublicCourse(course),
    archivedBecauseHistoricalData: enrolmentCount > 0,
  };
}
