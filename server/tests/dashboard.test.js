import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ClassificationResult from "../src/models/ClassificationResult.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";
import ActivityRecord from "../src/models/ActivityRecord.js";
import ImportBatch from "../src/models/ImportBatch.js";

const app = createApp();
const PREFIX = "dash-test-";

async function registerLecturer(suffix) {
  const email = `${PREFIX}${Date.now()}-${suffix}@example.com`;
  const response = await request(app).post("/api/v1/auth/register").send({
    fullName: `Dashboard ${suffix}`,
    email,
    password: "securePass1",
  });
  return { token: response.body.data.token, email };
}

describe("cross-course dashboard", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id");
    const courses = await Course.find({ lecturerId: { $in: users.map((row) => row._id) } }).select("_id");
    const courseIds = courses.map((row) => row._id);
    await ClassificationResult.deleteMany({ courseId: { $in: courseIds } });
    await ActivityRecord.deleteMany({ courseId: { $in: courseIds } });
    await ImportBatch.deleteMany({ courseId: { $in: courseIds } });
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ _id: { $in: courseIds } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^DASH/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  });

  test(
    "summary aggregates enrolment results and GET does not generate classifications",
    async () => {
    const { token } = await registerLecturer("agg");
    const auth = { Authorization: `Bearer ${token}` };
    const stamp = Date.now().toString().slice(-6);

    const courseA = await request(app)
      .post("/api/v1/courses")
      .set(auth)
      .send({ name: "Dash A", code: `DA${stamp}` });
    const courseB = await request(app)
      .post("/api/v1/courses")
      .set(auth)
      .send({ name: "Dash B", code: `DB${stamp}` });
    const courseAId = courseA.body.data.course.id;
    const courseBId = courseB.body.data.course.id;

    const student = await request(app)
      .post("/api/v1/students")
      .set(auth)
      .send({ fullName: "Dash Multi", matriculationNumber: `DASH${stamp}` });
    const studentId = student.body.data.student.id;

    await request(app).post(`/api/v1/courses/${courseAId}/enrollments`).set(auth).send({ studentId });
    await request(app).post(`/api/v1/courses/${courseBId}/enrollments`).set(auth).send({ studentId });

    const beforeCount = await ClassificationResult.countDocuments({
      courseId: { $in: [courseAId, courseBId] },
    });

    const emptySummary = await request(app)
      .get("/api/v1/dashboard/summary")
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", courseId: "all" })
      .set(auth);
    expect(emptySummary.status).toBe(200);
    expect(emptySummary.body.data.aggregationBasis).toBe("course_enrolment_results");
    expect(emptySummary.body.data.state).toBe("no_classifications");
    expect(emptySummary.body.data.enrolledCount).toBe(2);

    const afterEmpty = await ClassificationResult.countDocuments({
      courseId: { $in: [courseAId, courseBId] },
    });
    expect(afterEmpty).toBe(beforeCount);

    const matric = student.body.data.student.matriculationNumber;
    const activityCsv = Buffer.from(
      [
        "studentIdentifier,studentName,lastLearningActivityAt,learningMaterialsAvailable,learningMaterialsCompleted,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
        `${matric},Dash Multi,2026-10-29,10,8,4,3,2026-10-01,2026-10-31`,
      ].join("\n"),
      "utf8",
    );
    for (const courseId of [courseAId, courseBId]) {
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set(auth)
        .field("monitoringPeriodStart", "2026-10-01")
        .field("monitoringPeriodEnd", "2026-10-31")
        .attach("file", activityCsv, "activity.csv");
      expect(preview.status).toBe(201);
      await request(app)
        .post(`/api/v1/courses/${courseId}/imports/confirm`)
        .set(auth)
        .send({ importId: preview.body.data.id });
    }

    await request(app)
      .post(`/api/v1/courses/${courseAId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    await request(app)
      .post(`/api/v1/courses/${courseBId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });

    const latestSummary = await request(app)
      .get("/api/v1/dashboard/summary")
      .query({ periodScope: "latest", courseId: "all" })
      .set(auth);
    expect(latestSummary.status).toBe(200);
    expect(latestSummary.body.data.periodScope).toBe("latest");
    expect(latestSummary.body.data.counts.total).toBe(2);
    expect(latestSummary.body.data.enrolledUniqueStudentCount).toBe(1);
    expect(latestSummary.body.data.state).toBe("ready");

    const wrongPeriod = await request(app)
      .get("/api/v1/dashboard/summary")
      .query({ periodStart: "2026-01-01", periodEnd: "2026-01-31", courseId: "all" })
      .set(auth);
    expect(wrongPeriod.status).toBe(200);
    expect(wrongPeriod.body.data.periodScope).toBe("fixed");
    expect(wrongPeriod.body.data.state).toBe("no_classifications");

    const summary = await request(app)
      .get("/api/v1/dashboard/summary")
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", courseId: "all" })
      .set(auth);
    expect(summary.status).toBe(200);
    expect(summary.body.data.counts.total).toBe(2);
    expect(summary.body.data.uniqueStudentCount).toBe(1);
    expect(summary.body.data.aggregationLabel).toBe("Course enrolments");
    expect(summary.body.data.unclassifiedEnrolments).toBe(0);
    expect(summary.body.data.classificationCoveragePercent).toBe(100);

    const trend = await request(app)
      .get("/api/v1/dashboard/trend")
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", courseId: "all" })
      .set(auth);
    expect(trend.status).toBe(200);
    expect(trend.body.data.points.length).toBeGreaterThanOrEqual(1);

    const comparison = await request(app)
      .get("/api/v1/dashboard/course-comparison")
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", courseId: "all" })
      .set(auth);
    expect(comparison.status).toBe(200);
    expect(comparison.body.data.showComparison).toBe(true);
    expect(comparison.body.data.items.length).toBe(2);

    const attention = await request(app)
      .get("/api/v1/dashboard/attention-students")
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", courseId: "all" })
      .set(auth);
    expect(attention.status).toBe(200);
    expect(attention.body.data.results).toBeDefined();

    const allClassified = await request(app)
      .get("/api/v1/dashboard/attention-students")
      .query({
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        courseId: "all",
        focus: "all",
        limit: 25,
      })
      .set(auth);
    expect(allClassified.status).toBe(200);
    expect(allClassified.body.data.results.total).toBe(2);

    const other = await registerLecturer("other");
    const blocked = await request(app)
      .get("/api/v1/dashboard/summary")
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", courseId: courseAId })
      .set("Authorization", `Bearer ${other.token}`);
    expect(blocked.status).toBe(404);
  },
  90000,
  );

  test("course roster import creates courses, students and enrolments", async () => {
    const { token } = await registerLecturer("roster");
    const auth = { Authorization: `Bearer ${token}` };
    const stamp = Date.now().toString().slice(-5);
    const csv = [
      "courseCode,courseName,studentIdentifier,studentName",
      `HCI${stamp},HCI Course,DASHR${stamp}A,Ada Roster`,
      `HCI${stamp},HCI Course,DASHR${stamp}B,Bola Roster`,
    ].join("\n");

    const preview = await request(app)
      .post("/api/v1/courses/import-roster/preview")
      .set(auth)
      .attach("file", Buffer.from(csv), "roster.csv");
    expect(preview.status).toBe(201);
    expect(preview.body.data.summary.validRows).toBe(2);

    const confirm = await request(app)
      .post("/api/v1/courses/import-roster/confirm")
      .set(auth)
      .send({ importId: preview.body.data.importId });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.counts.coursesCreated).toBe(1);
    expect(confirm.body.data.counts.studentsCreated).toBe(2);
    expect(confirm.body.data.counts.enrolmentsCreated).toBe(2);

    const students = await request(app).get("/api/v1/students").set(auth);
    expect(students.status).toBe(200);
    expect(students.body.data.items.some((item) => item.matriculationNumber === `DASHR${stamp}A`)).toBe(true);
  });
});
