import mongoose from "mongoose";
import ClassificationResult from "../models/ClassificationResult.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Student from "../models/Student.js";
import { HttpError } from "../utils/httpError.js";
import { resolveRosterClassificationContext } from "./classification/classificationService.js";
import { paginated, parsePagination } from "../utils/pagination.js";
import { toPublicCourse, toPublicEnrollment, toPublicStudent } from "../utils/toPublic.js";

export async function listStudents(query, lecturerId) {
  const { page, limit, skip } = parsePagination(query);
  const courses = await Course.find({ lecturerId, status: { $ne: "deleted" } }).select("_id code name");
  const courseIds = courses.map((course) => course._id);
  if (!courseIds.length) {
    return paginated([], 0, page, limit);
  }

  const enrollments = await Enrollment.find({
    courseId: { $in: courseIds },
    status: query.enrollmentStatus === "all" ? { $in: ["active", "withdrawn"] } : "active",
  }).populate("studentId");

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
    const course = courses.find((item) => String(item._id) === String(enrollment.courseId));
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
    .select("studentId courseId classification displayScore generatedAt activitySnapshot monitoringPeriodStart monitoringPeriodEnd");

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
    lastActivityAt: snapshot.lastActivityAt || null,
    generatedAt: result?.generatedAt || null,
    monitoringPeriodStart: result?.monitoringPeriodStart || null,
    monitoringPeriodEnd: result?.monitoringPeriodEnd || null,
    resultId: result ? String(result._id) : null,
    materialsAccessed: snapshot.materialsAccessed ?? null,
    materialsAvailable: snapshot.materialsAvailable ?? null,
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

  const courses = await Course.find({ lecturerId, status: { $ne: "deleted" } }).select("_id code name");
  const courseIds = courses.map((course) => course._id);
  if (!courseIds.length) {
    throw new HttpError(404, "Student not found.");
  }

  const enrollments = await Enrollment.find({
    studentId,
    courseId: { $in: courseIds },
    status: "active",
  });
  if (!enrollments.length) {
    throw new HttpError(404, "Student not found.");
  }

  const studentCourses = enrollments
    .map((enrollment) => {
      const course = courses.find((item) => String(item._id) === String(enrollment.courseId));
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
    );

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
  const filter = { courseId };
  if (status) {
    filter.status = status;
  }

  const enrollments = await Enrollment.find(filter).sort({ enrolledAt: -1 }).populate("studentId");
  let items = enrollments.filter((row) => row.studentId).map((row) => toPublicEnrollment(row, row.studentId));

  const q = String(query.q || "").trim().toLowerCase();
  if (q) {
    items = items.filter(
      (item) =>
        String(item.student?.fullName || "")
          .toLowerCase()
          .includes(q) ||
        String(item.student?.matriculationNumber || "")
          .toLowerCase()
          .includes(q),
    );
  }

  const studentIds = items.map((item) => item.studentId);
  const latestByStudent = new Map();
  const rosterContext = await resolveRosterClassificationContext(courseId, query);
  if (rosterContext.runId && studentIds.length) {
    const results = await ClassificationResult.find({
      courseId,
      runId: rosterContext.runId,
      studentId: { $in: studentIds },
    }).sort({ generatedAt: -1 });
    for (const result of results) {
      const key = String(result.studentId);
      if (!latestByStudent.has(key)) {
        latestByStudent.set(key, result);
      }
    }
  }

  let enriched = items.map((item) => {
    const result = latestByStudent.get(item.studentId);
    return {
      ...item,
      classification: result?.classification || null,
      displayScore: result?.displayScore ?? null,
      lastActivityAt: result?.activitySnapshot?.lastActivityAt || null,
      resultId: result ? String(result._id) : null,
    };
  });

  if (query.classification) {
    const wanted = String(query.classification).toUpperCase();
    enriched = enriched.filter((item) => item.classification === wanted);
  }

  const sortBy = String(query.sortBy || "fullName");
  enriched.sort((left, right) => {
    if (sortBy === "classification") {
      return String(left.classification || "").localeCompare(String(right.classification || ""));
    }
    if (sortBy === "overallScore") {
      return (right.displayScore ?? -1) - (left.displayScore ?? -1);
    }
    if (sortBy === "matriculationNumber") {
      return String(left.student?.matriculationNumber || "").localeCompare(String(right.student?.matriculationNumber || ""));
    }
    return String(left.student?.fullName || "").localeCompare(String(right.student?.fullName || ""));
  });

  const total = enriched.length;
  return paginated(enriched.slice(skip, skip + limit), total, page, limit);
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
    return toPublicEnrollment(existing, student);
  }

  const enrollment = await Enrollment.create({
    studentId,
    courseId,
    status: "active",
    enrolledAt: new Date(),
  });
  return toPublicEnrollment(enrollment, student);
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
  const student = await Student.findById(enrollment.studentId);
  return toPublicEnrollment(enrollment, student);
}
