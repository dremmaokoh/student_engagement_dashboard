import mongoose from "mongoose";
import ClassificationResult from "../models/ClassificationResult.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Student from "../models/Student.js";
import { clearDashboardCache } from "../utils/dashboardCache.js";
import { HttpError } from "../utils/httpError.js";
import { resolveRosterClassificationContext } from "./classification/classificationService.js";
import { paginated, parsePagination } from "../utils/pagination.js";
import { toPublicCourse, toPublicEnrollment, toPublicStudent } from "../utils/toPublic.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listStudentsAvailableForCourse(query, lecturerId) {
  const { page, limit, skip } = parsePagination(query);
  if (!mongoose.isValidObjectId(query.availableForCourse)) {
    throw new HttpError(404, "Course was not found.");
  }
  const course = await Course.findOne({
    _id: query.availableForCourse,
    lecturerId,
    status: { $ne: "deleted" },
  })
    .select("_id")
    .lean();
  if (!course) {
    throw new HttpError(404, "Course was not found.");
  }

  const courses = await Course.find({ lecturerId, status: { $ne: "deleted" } }).select("_id").lean();
  const courseIds = courses.map((entry) => entry._id);
  const search = String(query.q || "").trim();
  const pipeline = [
    { $match: { courseId: { $in: courseIds }, status: "active" } },
    { $group: { _id: "$studentId", courses: { $addToSet: "$courseId" } } },
    { $match: { courses: { $nin: [course._id] } } },
    { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
  ];
  if (search) {
    const regex = escapeRegex(search);
    pipeline.push({
      $match: {
        $or: [
          { "student.fullName": { $regex: regex, $options: "i" } },
          { "student.matriculationNumber": { $regex: regex, $options: "i" } },
          { "student.email": { $regex: regex, $options: "i" } },
        ],
      },
    });
  }
  pipeline.push(
    { $sort: { "student.fullName": 1, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  );

  const [pageResult] = await Enrollment.aggregate(pipeline).collation({ locale: "en", strength: 2 });
  const items = (pageResult?.items || []).map((row) => toPublicStudent(row.student));
  return paginated(items, pageResult?.total?.[0]?.count || 0, page, limit);
}

export async function listStudents(query, lecturerId) {
  if (query.availableForCourse) {
    return listStudentsAvailableForCourse(query, lecturerId);
  }
  const { page, limit, skip } = parsePagination(query);
  const courses = await Course.find({ lecturerId, status: { $ne: "deleted" } })
    .select("_id code name")
    .lean();
  const courseIds = courses.map((course) => course._id);
  if (!courseIds.length) {
    return paginated([], 0, page, limit);
  }
  const courseById = new Map(courses.map((course) => [String(course._id), course]));

  const enrollments = await Enrollment.find({
    courseId: { $in: courseIds },
    status: query.enrollmentStatus === "all" ? { $in: ["active", "withdrawn"] } : "active",
  })
    .select("studentId courseId status enrolledAt")
    .populate("studentId", "fullName matriculationNumber email createdAt updatedAt")
    .lean();

  const byStudent = new Map();
  for (const enrollment of enrollments) {
    if (!enrollment.studentId) {
      continue;
    }
    const studentId = String(enrollment.studentId._id);
    if (!byStudent.has(studentId)) {
      byStudent.set(studentId, {
        student: toPublicStudent(enrollment.studentId),
        courses: [],
        enrollments: [],
      });
    }
    const course = courseById.get(String(enrollment.courseId));
    const entry = byStudent.get(studentId);
    entry.enrollments.push(toPublicEnrollment(enrollment, enrollment.studentId));
    if (course) {
      entry.courses.push({ id: String(course._id), code: course.code, name: course.name });
    }
  }

  let items = [...byStudent.values()];
  const q = String(query.q || "").trim().toLowerCase();
  if (q) {
    items = items.filter(
      (item) =>
        String(item.student.fullName || "")
          .toLowerCase()
          .includes(q) ||
        String(item.student.matriculationNumber || "")
          .toLowerCase()
          .includes(q) ||
        String(item.student.email || "")
          .toLowerCase()
          .includes(q),
    );
  }

  if (query.courseId && mongoose.isValidObjectId(query.courseId)) {
    items = items.filter((item) => item.courses.some((course) => course.id === String(query.courseId)));
  }

  const studentIds = items.map((item) => item.student.id);
  const latestResults = await ClassificationResult.find({
    studentId: { $in: studentIds },
    courseId: { $in: courseIds },
  })
    .sort({ generatedAt: -1 })
    .select("studentId courseId classification displayScore generatedAt activitySnapshot monitoringPeriodStart monitoringPeriodEnd")
    .lean();

  const resultByKey = new Map();
  for (const result of latestResults) {
    const key = `${result.studentId}:${result.courseId}`;
    if (!resultByKey.has(key)) {
      resultByKey.set(key, result);
    }
  }

  const withResults = items.map((item) => ({
    ...item.student,
    courses: item.courses,
    courseResults: item.courses.map((course) =>
      mapResultToCourseRow(course, resultByKey.get(`${item.student.id}:${course.id}`)),
    ),
  }));

  const classificationFilter = String(query.classification || "").trim();
  let filtered = withResults;
  if (classificationFilter === "NOT_CLASSIFIED") {
    filtered = withResults.filter((item) => item.courseResults.some((result) => !result.classification));
  } else if (
    ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"].includes(classificationFilter)
  ) {
    filtered = withResults.filter((item) =>
      item.courseResults.some((result) => result.classification === classificationFilter),
    );
  }

  const sortBy = String(query.sortBy || "fullName");
  filtered.sort((left, right) => {
    if (sortBy === "matriculationNumber") {
      return String(left.matriculationNumber || "").localeCompare(String(right.matriculationNumber || ""));
    }
    return String(left.fullName || "").localeCompare(String(right.fullName || ""));
  });
  const total = filtered.length;
  const pageItems = filtered.slice(skip, skip + limit);

  return paginated(pageItems, total, page, limit);
}

function mapResultToCourseRow(course, result) {
  const snapshot = result?.activitySnapshot || {};
  return {
    course,
    classification: result?.classification || null,
    displayScore: result?.displayScore ?? null,
    lastLearningActivityAt: snapshot.lastLearningActivityAt || snapshot.lastActivityAt || null,
    lastActivityAt: snapshot.lastLearningActivityAt || snapshot.lastActivityAt || null,
    generatedAt: result?.generatedAt || null,
    monitoringPeriodStart: result?.monitoringPeriodStart || null,
    monitoringPeriodEnd: result?.monitoringPeriodEnd || null,
    resultId: result ? String(result._id) : null,
    learningItemsCompleted: snapshot.learningItemsCompleted ?? snapshot.materialsAccessed ?? null,
    learningItemsRequired: snapshot.learningItemsRequired ?? snapshot.materialsAvailable ?? null,
    materialsAccessed: snapshot.learningItemsCompleted ?? snapshot.materialsAccessed ?? null,
    materialsAvailable: snapshot.learningItemsRequired ?? snapshot.materialsAvailable ?? null,
    assignmentsSubmitted: snapshot.assignmentsSubmitted ?? null,
    assignmentsDue: snapshot.assignmentsDue ?? null,
  };
}

export async function getStudentParticipationProfile(studentId, lecturerId) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new HttpError(404, "Student not found.");
  }
  const student = await Student.findById(studentId);
  if (!student) {
    throw new HttpError(404, "Student not found.");
  }

  const courses = await Course.find({ lecturerId, status: { $ne: "deleted" } })
    .select("_id code name")
    .lean();
  const courseIds = courses.map((course) => course._id);
  if (!courseIds.length) {
    throw new HttpError(404, "Student not found.");
  }
  const courseById = new Map(courses.map((course) => [String(course._id), course]));

  const enrollments = await Enrollment.find({
    studentId,
    courseId: { $in: courseIds },
    status: "active",
  })
    .select("courseId")
    .lean();
  if (!enrollments.length) {
    throw new HttpError(404, "Student not found.");
  }

  const studentCourses = enrollments
    .map((enrollment) => {
      const course = courseById.get(String(enrollment.courseId));
      if (!course) {
        return null;
      }
      return { id: String(course._id), code: course.code, name: course.name };
    })
    .filter(Boolean)
    .sort((left, right) => String(left.code).localeCompare(String(right.code)));

  const latestResults = await ClassificationResult.find({
    studentId,
    courseId: { $in: courseIds },
  })
    .sort({ generatedAt: -1 })
    .select(
      "courseId classification displayScore generatedAt activitySnapshot monitoringPeriodStart monitoringPeriodEnd",
    )
    .lean();

  const resultByCourse = new Map();
  for (const result of latestResults) {
    const key = String(result.courseId);
    if (!resultByCourse.has(key)) {
      resultByCourse.set(key, result);
    }
  }

  const courseResults = studentCourses.map((course) =>
    mapResultToCourseRow(course, resultByCourse.get(course.id)),
  );

  return {
    ...toPublicStudent(student),
    courses: studentCourses,
    courseResults,
  };
}

export async function createStudent(input) {
  try {
    const student = await Student.create(input);
    clearDashboardCache();
    return toPublicStudent(student);
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(409, "A student with this matriculation number already exists.");
    }
    throw error;
  }
}

export async function getStudent(studentId, lecturerId) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new HttpError(404, "Student not found.");
  }
  const student = await Student.findById(studentId);
  if (!student) {
    throw new HttpError(404, "Student not found.");
  }

  if (lecturerId) {
    const courses = await Course.find({ lecturerId }).select("_id");
    const courseIds = courses.map((course) => course._id);
    const enrollment = await Enrollment.findOne({ studentId, courseId: { $in: courseIds } });
    if (!enrollment) {
      throw new HttpError(404, "Student not found.");
    }
  }

  return toPublicStudent(student);
}

export async function updateStudent(studentId, input) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new HttpError(404, "Student not found.");
  }
  try {
    const student = await Student.findByIdAndUpdate(studentId, input, {
      new: true,
      runValidators: true,
    });
    if (!student) {
      throw new HttpError(404, "Student not found.");
    }
    clearDashboardCache();
    return toPublicStudent(student);
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(409, "A student with this matriculation number already exists.");
    }
    throw error;
  }
}

export async function listCourseStudents(courseId, query) {
  const { page, limit, skip } = parsePagination(query);
  const status = query.status === "withdrawn" ? "withdrawn" : query.status === "all" ? null : "active";
  const courseObjectId = courseId instanceof mongoose.Types.ObjectId ? courseId : new mongoose.Types.ObjectId(String(courseId));
  const filter = { courseId: courseObjectId };
  if (status) {
    filter.status = status;
  }

  const rosterContext = await resolveRosterClassificationContext(courseObjectId, query);
  const wanted = query.classification ? String(query.classification).toUpperCase() : "";
  if (wanted && !rosterContext.runId) {
    return paginated([], 0, page, limit);
  }

  const search = String(query.q || "").trim();
  const sortBy = String(query.sortBy || "fullName");
  const sortField =
    sortBy === "overallScore"
      ? "scoreSort"
      : sortBy === "classification"
        ? "result.classification"
        : sortBy === "matriculationNumber"
          ? "student.matriculationNumber"
          : "student.fullName";
  const sortDirection = sortBy === "overallScore" ? -1 : 1;

  const pipeline = [
    { $match: filter },
    { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
  ];
  if (search) {
    const regex = escapeRegex(search);
    pipeline.push({
      $match: {
        $or: [
          { "student.fullName": { $regex: regex, $options: "i" } },
          { "student.matriculationNumber": { $regex: regex, $options: "i" } },
        ],
      },
    });
  }
  if (rosterContext.runId) {
    pipeline.push({
    $lookup: {
      from: "classificationresults",
      let: { studentId: "$studentId" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$courseId", courseObjectId] },
                { $eq: ["$runId", rosterContext.runId] },
                { $eq: ["$studentId", "$$studentId"] },
              ],
            },
          },
        },
        { $sort: { generatedAt: -1 } },
        { $limit: 1 },
        { $project: { classification: 1, displayScore: 1, activitySnapshot: 1 } },
      ],
      as: "result",
    },
  });
    pipeline.push({ $unwind: { path: "$result", preserveNullAndEmptyArrays: true } });
  }
  if (wanted) {
    pipeline.push({ $match: { "result.classification": wanted } });
  }
  if (sortBy === "overallScore") {
    pipeline.push({ $addFields: { scoreSort: { $ifNull: ["$result.displayScore", -1] } } });
  }
  pipeline.push(
    { $sort: { [sortField]: sortDirection, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  );

  const [pageResult] = await Enrollment.aggregate(pipeline).collation({ locale: "en", strength: 2 });
  const items = (pageResult?.items || []).map((row) => {
    const result = row.result;
    const activityAt = result?.activitySnapshot?.lastLearningActivityAt || result?.activitySnapshot?.lastActivityAt || null;
    return {
      ...toPublicEnrollment(row, row.student),
      classification: result?.classification || null,
      displayScore: result?.displayScore ?? null,
      lastLearningActivityAt: activityAt,
      lastActivityAt: activityAt,
      resultId: result ? String(result._id) : null,
    };
  });
  return paginated(items, pageResult?.total?.[0]?.count || 0, page, limit);
}

export async function enrolStudent(courseId, studentId) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new HttpError(400, "A valid studentId is required.");
  }
  const student = await Student.findById(studentId);
  if (!student) {
    throw new HttpError(404, "Student not found.");
  }

  const existing = await Enrollment.findOne({ studentId, courseId });
  if (existing) {
    if (existing.status === "active") {
      throw new HttpError(409, "This student is already enrolled in the course.");
    }
    existing.status = "active";
    existing.enrolledAt = new Date();
    await existing.save();
    clearDashboardCache();
    return toPublicEnrollment(existing, student);
  }

  const enrollment = await Enrollment.create({
    studentId,
    courseId,
    status: "active",
    enrolledAt: new Date(),
  });
  clearDashboardCache();
  return toPublicEnrollment(enrollment, student);
}

export async function enrolStudents(courseId, studentIdsInput) {
  const studentIds = [...new Set((Array.isArray(studentIdsInput) ? studentIdsInput : []).filter(Boolean).map(String))];
  if (!studentIds.length) {
    throw new HttpError(400, "Select at least one student.");
  }
  if (studentIds.some((studentId) => !mongoose.isValidObjectId(studentId))) {
    throw new HttpError(400, "A valid studentId is required.");
  }

  const students = await Student.find({ _id: { $in: studentIds } }).select("_id").lean();
  const studentsById = new Set(students.map((student) => String(student._id)));
  const missingCount = studentIds.filter((studentId) => !studentsById.has(studentId)).length;
  if (missingCount) {
    throw new HttpError(404, `${missingCount} selected student${missingCount === 1 ? "" : "s"} could not be found.`);
  }

  const existing = await Enrollment.find({ courseId, studentId: { $in: studentIds } })
    .select("studentId status")
    .lean();
  const existingByStudent = new Map(existing.map((row) => [String(row.studentId), row]));
  const operations = [];
  let reactivated = 0;

  for (const studentId of studentIds) {
    const current = existingByStudent.get(studentId);
    if (!current) {
      operations.push({
        insertOne: {
          document: {
            studentId,
            courseId: String(courseId),
            status: "active",
            enrolledAt: new Date(),
          },
        },
      });
    } else if (current.status !== "active") {
      operations.push({
        updateOne: {
          filter: { _id: current._id },
          update: { $set: { status: "active", enrolledAt: new Date() } },
        },
      });
      reactivated += 1;
    }
  }

  const created = operations.length ? (await Enrollment.bulkWrite(operations, { ordered: false })).insertedCount : 0;
  clearDashboardCache();
  return {
    enrolled: created + reactivated,
    alreadyEnrolled: studentIds.length - created - reactivated,
  };
}

export async function updateEnrollment(enrollmentId, lecturerId, { status }) {
  if (!["active", "withdrawn"].includes(status)) {
    throw new HttpError(400, "Enrollment status must be active or withdrawn.");
  }
  if (!mongoose.isValidObjectId(enrollmentId)) {
    throw new HttpError(404, "Enrollment not found.");
  }

  const enrollment = await Enrollment.findById(enrollmentId).populate("courseId");
  if (!enrollment || String(enrollment.courseId.lecturerId) !== String(lecturerId)) {
    throw new HttpError(404, "Enrollment not found.");
  }

  enrollment.status = status;
  await enrollment.save();
  clearDashboardCache();
  const student = await Student.findById(enrollment.studentId);
  return toPublicEnrollment(enrollment, student);
}
