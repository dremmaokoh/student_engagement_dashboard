import ClassificationResult from "../models/ClassificationResult.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
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

  const [items, total] = await Promise.all([
    Course.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Course.countDocuments(filter),
  ]);

  const enriched = [];
  for (const course of items) {
    const enrolledCount = await Enrollment.countDocuments({ courseId: course._id, status: "active" });
    const latest = await ClassificationResult.findOne({ courseId: course._id })
      .sort({ generatedAt: -1 })
      .select("runId generatedAt monitoringPeriodStart monitoringPeriodEnd");
    let counts = emptyCounts();
    if (latest) {
      const results = await ClassificationResult.find({ courseId: course._id, runId: latest.runId }).select(
        "classification",
      );
      counts.total = results.length;
      for (const result of results) {
        if (counts[result.classification] !== undefined) {
          counts[result.classification] += 1;
        }
      }
    }
    enriched.push({
      ...toPublicCourse(course),
      enrolledCount,
      latestClassificationAt: latest?.generatedAt || null,
      latestPeriodStart: latest?.monitoringPeriodStart || null,
      latestPeriodEnd: latest?.monitoringPeriodEnd || null,
      counts: latest ? counts : null,
    });
  }

  return paginated(enriched, total, page, limit);
}

export async function createCourse(lecturerId, input) {
  try {
    const course = await Course.create({ ...input, lecturerId, status: "active" });
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
  return {
    course: toPublicCourse(course),
    archivedBecauseHistoricalData: enrolmentCount > 0,
  };
}
