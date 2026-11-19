import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ActivityRecord from "../src/models/ActivityRecord.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import ImportBatch from "../src/models/ImportBatch.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "phase3-test-";

function csv(body) {
  return Buffer.from(body, "utf8");
}

async function seed() {
  const email = `${PREFIX}${Date.now()}@example.com`;
  const auth = await request(app).post("/api/v1/auth/register").send({
    fullName: "Import Lecturer",
    email,
    password: "securePass1",
  });
  const token = auth.body.data.token;
  const code = `P3${Date.now().toString().slice(-6)}`;
  const course = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Import Course", code });
  const matric = `P3${Date.now().toString().slice(-8)}`;
  const student = await request(app)
    .post("/api/v1/students")
    .set("Authorization", `Bearer ${token}`)
    .send({ fullName: "Import Student", matriculationNumber: matric });
  await request(app)
    .post(`/api/v1/courses/${course.body.data.course.id}/enrollments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ studentId: student.body.data.student.id });
  return { token, courseId: course.body.data.course.id, matric, studentId: student.body.data.student.id };
}

describe("CSV import", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  }, 120000);

  afterAll(async () => {
    const courses = await Course.find({ code: { $regex: /^P3/ } }).select("_id");
    const courseIds = courses.map((row) => row._id);
    await ActivityRecord.deleteMany({ courseId: { $in: courseIds } });
    await ImportBatch.deleteMany({ courseId: { $in: courseIds } });
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ code: { $regex: /^P3/ } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^P3/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  }, 120000);

  test(
    "downloads a CSV template",
    async () => {
    const { token, courseId, matric } = await seed();
    const response = await request(app)
      .get(`/api/v1/courses/${courseId}/imports/template`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(
      "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
    );
    expect(response.text).not.toContain("materialAccessEvents");
    expect(response.text).not.toContain("assignmentSubmissionEvents");
    expect(response.headers["content-type"]).toMatch(/csv/);
    expect(response.text).toContain(matric);
    expect(response.text).toContain("Import Student");
    },
    120000
  );

  test(
    "rejects activity CSV files that include removed event columns",
    async () => {
    const { token, courseId, matric } = await seed();
    const withEvents = csv(
      [
        "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd,materialAccessEvents,assignmentSubmissionEvents",
        `${matric},Import Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31,,`,
      ].join("\n"),
    );
    const preview = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/preview`)
      .set("Authorization", `Bearer ${token}`)
      .field("monitoringPeriodStart", "2026-10-01")
      .field("monitoringPeriodEnd", "2026-10-31")
      .attach("file", withEvents, "events.csv");
    expect(preview.status).toBe(400);
    expect(preview.body.message || preview.body.error || "").toMatch(/exactly|Unexpected|nine/i);
    },
    120000
  );

  test(
    "rejects invalid counts with row-level details and preserves missing values",
    async () => {
    const { token, courseId, matric } = await seed();
    const invalid = csv(
      [
        "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
        `${matric},Import Student,,5,9,2,1,2026-10-01,2026-10-31`,
      ].join("\n"),
    );

    const preview = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/preview`)
      .set("Authorization", `Bearer ${token}`)
      .field("monitoringPeriodStart", "2026-10-01")
      .field("monitoringPeriodEnd", "2026-10-31")
      .attach("file", invalid, "bad.csv");

    expect(preview.status).toBe(201);
    expect(preview.body.data.rejectedCount).toBe(1);
    expect(preview.body.data.errors[0].reason).toMatch(/cannot exceed/i);
    },
    120000
  );

  test(
    "previews and confirms a valid CSV, then skips duplicates",
    async () => {
    const { token, courseId, matric } = await seed();
    const valid = csv(
      [
        "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
        `${matric},Import Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31`,
      ].join("\n"),
    );

    const preview = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/preview`)
      .set("Authorization", `Bearer ${token}`)
      .field("monitoringPeriodStart", "2026-10-01")
      .field("monitoringPeriodEnd", "2026-10-31")
      .attach("file", valid, "good.csv");

    expect(preview.status).toBe(201);
    expect(preview.body.data.validCount).toBe(1);
    expect(preview.body.data.validRows[0].lastActivityAt).toBeTruthy();
    expect(preview.body.data.validRows[0].materialsAvailable).toBe(10);

    const missingDate = csv(
      [
        "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
        `${matric},Import Student,,10,0,4,0,2026-10-01,2026-10-31`,
      ].join("\n"),
    );
    const missingPreview = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/preview`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", missingDate, "missing.csv");
    expect(missingPreview.body.data.validRows[0].lastActivityAt).toBeNull();
    expect(missingPreview.body.data.validRows[0].materialsAccessed).toBe(0);

    const confirmed = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ importId: preview.body.data.id });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.importedCount).toBe(1);

    const again = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ importId: preview.body.data.id });
    expect(again.body.data.importedCount).toBe(1);

    const secondPreview = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/preview`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", valid, "good-again.csv");
    const secondConfirm = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ importId: secondPreview.body.data.id });
    expect(secondConfirm.body.data.skippedCount).toBe(1);
    expect(secondConfirm.body.data.importedCount).toBe(0);
    },
    120000
  );

  test(
    "rejects a student who is not enrolled",
    async () => {
      const { token, courseId } = await seed();
      const invalid = csv(
        [
          "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
          "UNKNOWN999,Unknown Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31",
        ].join("\n"),
      );
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .field("monitoringPeriodStart", "2026-10-01")
        .field("monitoringPeriodEnd", "2026-10-31")
        .attach("file", invalid, "unknown.csv");
      expect(preview.status).toBe(201);
      expect(preview.body.data.errors[0].reason).toMatch(/enrolled/i);
    },
    120000
  );
});
