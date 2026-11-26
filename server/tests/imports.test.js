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

const HEADERS =
  "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd";

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

  test(
    "rejects invalid dates and blocks confirmation when no rows are valid",
    async () => {
      const { token, courseId, matric } = await seed();
      const invalidDates = csv(
        [
          HEADERS,
          `${matric},Import Student,not-a-date,10,8,4,3,2026-10-01,2026-10-31`,
          `${matric},Import Student,2026-02-30,10,8,4,3,2026-10-01,2026-10-31`,
        ].join("\n"),
      );
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", invalidDates, "invalid-dates.csv");

      expect(preview.status).toBe(201);
      expect(preview.body.data.totalCount).toBe(2);
      expect(preview.body.data.validCount).toBe(0);
      expect(preview.body.data.rejectedCount).toBe(2);
      expect(preview.body.data.errors).toHaveLength(2);
      expect(preview.body.data.errors[0].reason).toMatch(/valid date/i);

      const confirmation = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({ importId: preview.body.data.id });
      expect(confirmation.status).toBe(400);
      expect(confirmation.body.message).toMatch(/no valid records/i);
    },
    120000
  );

  test(
    "rejects invalid numeric values and keeps empty activity cells as null",
    async () => {
      const { token, courseId, matric } = await seed();
      const mixedCells = csv(
        [
          HEADERS,
          `${matric},Import Student,2026-10-20,10,abc,4,3,2026-10-01,2026-10-31`,
          `${matric},Import Student,,,,,,2026-11-01,2026-11-30`,
        ].join("\n"),
      );
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", mixedCells, "mixed-cells.csv");

      expect(preview.status).toBe(201);
      expect(preview.body.data.validCount).toBe(1);
      expect(preview.body.data.rejectedCount).toBe(1);
      expect(preview.body.data.errors[0].reason).toMatch(/non-negative integer/i);
      expect(preview.body.data.validRows[0].lastActivityAt).toBeNull();
      expect(preview.body.data.validRows[0].materialsAccessed).toBeNull();
      expect(preview.body.data.validRows[0].assignmentsSubmitted).toBeNull();
    },
    120000
  );

  test(
    "summarises mixed valid, rejected and duplicate records",
    async () => {
      const { token, courseId, matric } = await seed();
      const mixed = csv(
        [
          HEADERS,
          `${matric},Import Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31`,
          `${matric},Import Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31`,
          "UNKNOWN999,Unknown Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31",
        ].join("\n"),
      );
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", mixed, "mixed.csv");

      expect(preview.status).toBe(201);
      expect(preview.body.data.totalCount).toBe(3);
      expect(preview.body.data.validCount).toBe(1);
      expect(preview.body.data.rejectedCount).toBe(2);
      expect(preview.body.data.duplicateCount).toBe(1);
      expect(preview.body.data.validRows).toHaveLength(1);
      expect(preview.body.data.errors.map((error) => error.reason)).toContainEqual(
        expect.stringMatching(/duplicate/i),
      );

      const confirmation = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({ importId: preview.body.data.id });
      expect(confirmation.status).toBe(200);
      expect(confirmation.body.data.importedCount).toBe(1);
    },
    120000
  );

  test(
    "rejects a CSV with a missing required column",
    async () => {
      const { token, courseId, matric } = await seed();
      const missingColumn = csv(
        [
          "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,monitoringPeriodStart,monitoringPeriodEnd",
          `${matric},Import Student,2026-10-20,10,8,4,2026-10-01,2026-10-31`,
        ].join("\n"),
      );
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", missingColumn, "missing-column.csv");

      expect(preview.status).toBe(400);
      expect(preview.body.message || preview.body.error || "").toMatch(/assignmentsSubmitted/i);
    },
    120000
  );

  test(
    "rejects empty activity CSV files",
    async () => {
      const { token, courseId } = await seed();
      const headerOnly = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", csv(`${HEADERS}\n`), "header-only.csv");
      expect(headerOnly.status).toBe(400);
      expect(headerOnly.body.message || headerOnly.body.error || "").toMatch(/no data rows/i);

      const emptyFile = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", csv(""), "empty.csv");
      expect(emptyFile.status).toBe(400);
      expect(emptyFile.body.message || emptyFile.body.error || "").toMatch(/no data rows|could not be parsed/i);
    },
    120000
  );

  test(
    "recognises spaced and mixed-case activity headers",
    async () => {
      const { token, courseId, matric } = await seed();
      const spacedHeaders = csv(
        [
          "Student Identifier,Student Name,Last Activity At,Materials Available,Materials Accessed,Assignments Due,Assignments Submitted,Monitoring Period Start,Monitoring Period End",
          `${matric},Import Student,2026-10-20,10,8,4,3,2026-10-01,2026-10-31`,
        ].join("\n"),
      );
      const preview = await request(app)
        .post(`/api/v1/courses/${courseId}/imports/preview`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", spacedHeaders, "spaced-headers.csv");

      expect(preview.status).toBe(201);
      expect(preview.body.data.validCount).toBe(1);
      expect(preview.body.data.validRows[0].materialsAccessed).toBe(8);
    },
    120000
  );
});
