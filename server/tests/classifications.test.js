import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ActivityRecord from "../src/models/ActivityRecord.js";
import ClassificationConfig from "../src/models/ClassificationConfig.js";
import ClassificationResult from "../src/models/ClassificationResult.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import ImportBatch from "../src/models/ImportBatch.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "phase5-test-";

function csv(body) {
  return Buffer.from(body, "utf8");
}

async function seed() {
  const email = `${PREFIX}${Date.now()}@example.com`;
  const auth = await request(app).post("/api/v1/auth/register").send({
    fullName: "Classify Lecturer",
    email,
    password: "securePass1",
  });
  const token = auth.body.data.token;
  const code = `P5${Date.now().toString().slice(-6)}`;
  const course = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Classify Course", code });
  const courseId = course.body.data.course.id;

  const high = await request(app)
    .post("/api/v1/students")
    .set("Authorization", `Bearer ${token}`)
    .send({ fullName: "High Activity", matriculationNumber: `P5${Date.now().toString().slice(-7)}A` });
  const none = await request(app)
    .post("/api/v1/students")
    .set("Authorization", `Bearer ${token}`)
    .send({ fullName: "No Import", matriculationNumber: `P5${Date.now().toString().slice(-7)}B` });

  await request(app)
    .post(`/api/v1/courses/${courseId}/enrollments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ studentId: high.body.data.student.id });
  await request(app)
    .post(`/api/v1/courses/${courseId}/enrollments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ studentId: none.body.data.student.id });

  const file = csv(
    [
      "studentIdentifier,studentName,lastLearningActivityAt,learningMaterialsAvailable,learningMaterialsCompleted,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
      `${high.body.data.student.matriculationNumber},High Activity,2026-10-29,10,8,4,3,2026-10-01,2026-10-31`,
    ].join("\n"),
  );
  const preview = await request(app)
    .post(`/api/v1/courses/${courseId}/imports/preview`)
    .set("Authorization", `Bearer ${token}`)
    .field("monitoringPeriodStart", "2026-10-01")
    .field("monitoringPeriodEnd", "2026-10-31")
    .attach("file", file, "activity.csv");
  await request(app)
    .post(`/api/v1/courses/${courseId}/imports/confirm`)
    .set("Authorization", `Bearer ${token}`)
    .send({ importId: preview.body.data.id });

  return {
    token,
    courseId,
    highId: high.body.data.student.id,
    noneId: none.body.data.student.id,
  };
}

describe("classification generation and dashboard", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id");
    const courses = await Course.find({ lecturerId: { $in: users.map((row) => row._id) } }).select("_id");
    const courseIds = courses.map((row) => row._id);
    await ClassificationResult.deleteMany({ courseId: { $in: courseIds } });
    await ClassificationConfig.deleteMany({ courseId: { $in: courseIds } });
    await ActivityRecord.deleteMany({ courseId: { $in: courseIds } });
    await ImportBatch.deleteMany({ courseId: { $in: courseIds } });
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ _id: { $in: courseIds } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^P5/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  });

  test("generates persisted results and dashboard counts", async () => {
    const { token, courseId, highId, noneId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const generated = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });

    expect(generated.status).toBe(201);
    expect(generated.body.data.runName).toBe("October Run");
    expect(generated.body.data.generatedCount).toBe(2);
    expect(generated.body.data.counts.ACTIVE).toBe(1);
    expect(generated.body.data.counts.INSUFFICIENT_DATA).toBe(1);

    const high = generated.body.data.items.find((item) => item.studentId === highId);
    expect(high.overallScore).toBe(84);
    expect(high.displayScore).toBe(84);
    expect(high.classification).toBe("ACTIVE");
    expect(high.indicators.lastActivity.score).toBe(100);
    expect(high.indicators.materialAccess.score).toBe(80);
    expect(high.indicators.assignmentSubmission.score).toBe(75);
    expect(high.configurationVersion).toBe(1);

    const missing = generated.body.data.items.find((item) => item.studentId === noneId);
    expect(missing.classification).toBe("INSUFFICIENT_DATA");
    expect(missing.overallScore).toBeNull();
    expect(missing.activityRecordId).toBeNull();

    const dashboard = await request(app)
      .get(`/api/v1/courses/${courseId}/dashboard`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31" })
      .set(auth);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.counts).toEqual(generated.body.data.counts);

    const runs = await request(app)
      .get(`/api/v1/courses/${courseId}/classification-runs`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31" })
      .set(auth);
    expect(runs.status).toBe(200);
    expect(runs.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(runs.body.data.items[0].runId).toBe(generated.body.data.runId);
    expect(runs.body.data.items[0].runName).toBe("October Run");
    expect(dashboard.body.data.runName).toBe("October Run");
    expect(dashboard.body.data.enrolledCount).toBe(2);
    expect(dashboard.body.data.results.total).toBe(2);
    expect(dashboard.body.data.activityImportUsed).toBeTruthy();
    expect(dashboard.body.data.activityImportUsed.filename).toBe("activity.csv");
    expect(dashboard.body.data.activityImportUsed.importedCount).toBeGreaterThanOrEqual(1);

    const withActivity = dashboard.body.data.results.items.find((item) => item.activityRecordId);
    expect(withActivity?.activityImport?.filename).toBe("activity.csv");
    const withoutActivity = dashboard.body.data.results.items.find((item) => !item.activityRecordId);
    expect(withoutActivity?.activityImport).toBeNull();

    const detail = await request(app)
      .get(`/api/v1/courses/${courseId}/classification-results/${high.id}`)
      .set(auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.result.explanation.overall).toBeTruthy();
    expect(detail.body.data.result.activitySnapshot.materialsAccessed).toBe(8);

    const exported = await request(app)
      .get(
        `/api/v1/courses/${courseId}/classification-results/export?periodStart=2026-10-01&periodEnd=2026-10-31&runId=${generated.body.data.runId}`,
      )
      .set(auth);
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toMatch(/csv/);
    expect(exported.text).toContain("studentIdentifier,studentName,overallScore,classification");
    expect(exported.text).toContain("ACTIVE");
  });

  test("scope=all returns every classification run for the course", async () => {
    const { token, courseId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const first = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    expect(first.status).toBe(201);

    await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set(auth)
      .send({
        weights: { lastActivity: 50, materialAccess: 25, assignmentSubmission: 25 },
        changeNote: "Second run",
      });

    const second = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    expect(second.status).toBe(201);
    expect(second.body.data.runId).not.toBe(first.body.data.runId);

    const allRuns = await request(app)
      .get(`/api/v1/courses/${courseId}/classification-runs`)
      .query({ scope: "all" })
      .set(auth);

    expect(allRuns.status).toBe(200);
    expect(allRuns.body.data.scope).toBe("all");
    expect(allRuns.body.data.items).toHaveLength(2);
    expect(allRuns.body.data.items[0].runId).toBe(second.body.data.runId);
    expect(allRuns.body.data.items[1].runId).toBe(first.body.data.runId);
  });

  test("historical results keep the original config after a settings change", async () => {
    const { token, courseId, highId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const first = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    const original = first.body.data.items.find((item) => item.studentId === highId);
    expect(original.configurationSnapshot.weights.assignmentSubmission).toBe(0.4);
    expect(original.configurationSnapshot.activeIndicators).toEqual({
      lastActivity: true,
      materialAccess: true,
      assignmentSubmission: true,
    });

    await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set(auth)
      .send({
        weights: { lastActivity: 40, materialAccess: 30, assignmentSubmission: 60 },
        activeIndicators: { lastActivity: true, materialAccess: false, assignmentSubmission: true },
        changeNote: "Two indicators",
      });

    const second = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    const newer = second.body.data.items.find((item) => item.studentId === highId);
    expect(newer.configurationSnapshot.globalWeightsVersion).toBe(2);
    expect(newer.configurationSnapshot.weights.assignmentSubmission).toBeCloseTo(0.6);
    expect(newer.configurationSnapshot.activeIndicators.materialAccess).toBe(false);
    expect(newer.indicators.materialAccess.status).toBe("DISABLED");

    const historic = await request(app)
      .get(`/api/v1/courses/${courseId}/classification-results/${original.id}`)
      .set(auth);
    expect(historic.body.data.result.configurationVersion).toBe(1);
    expect(historic.body.data.result.configurationSnapshot.weights.assignmentSubmission).toBe(0.4);
    expect(historic.body.data.result.configurationSnapshot.activeIndicators.materialAccess).toBe(true);
    expect(historic.body.data.result.indicators.materialAccess.status).not.toBe("DISABLED");
    expect(historic.body.data.result.overallScore).toBe(84);
  });

  test("unauthenticated generate is rejected", async () => {
    const response = await request(app).post("/api/v1/courses/000000000000000000000000/classifications/generate");
    expect(response.status).toBe(401);
  });

  test("generate requires a run name", async () => {
    const { token, courseId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const missing = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    expect(missing.status).toBe(400);

    const blank = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "   ", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    expect(blank.status).toBe(400);
  });

  test(
    "generation resolves activity when request period differs from imported record period",
    async () => {
    const email = `${PREFIX}period-mismatch-${Date.now()}@example.com`;
    const authResponse = await request(app).post("/api/v1/auth/register").send({
      fullName: "Period Mismatch Lecturer",
      email,
      password: "securePass1",
    });
    const token = authResponse.body.data.token;
    const auth = { Authorization: `Bearer ${token}` };

    const code = `P9${Date.now().toString().slice(-6)}`;
    const course = await request(app)
      .post("/api/v1/courses")
      .set(auth)
      .send({ name: "Nine Student Course", code });
    const courseId = course.body.data.course.id;

    const matricPrefix = `P9${Date.now().toString().slice(-6)}`;
    const studentIds = [];
    const csvRows = [
      "studentIdentifier,studentName,lastLearningActivityAt,learningMaterialsAvailable,learningMaterialsCompleted,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
    ];
    for (let index = 0; index < 9; index += 1) {
      const matric = `${matricPrefix}${index}`;
      const created = await request(app)
        .post("/api/v1/students")
        .set(auth)
        .send({ fullName: `Student ${index + 1}`, matriculationNumber: matric });
      studentIds.push(created.body.data.student.id);
      await request(app)
        .post(`/api/v1/courses/${courseId}/enrollments`)
        .set(auth)
        .send({ studentId: created.body.data.student.id });
      csvRows.push(
        `${matric},Student ${index + 1},2026-10-29,10,8,4,3,2026-10-01,2026-11-10`,
      );
    }

    const preview = await request(app)
      .post(`/api/v1/courses/${courseId}/imports/preview`)
      .set(auth)
      .field("monitoringPeriodStart", "2026-10-01")
      .field("monitoringPeriodEnd", "2026-10-31")
      .attach("file", csv(Buffer.from(csvRows.join("\n"), "utf8")), "nine-students.csv");

    expect(preview.status).toBe(201);
    await request(app)
      .post(`/api/v1/courses/${courseId}/imports/confirm`)
      .set(auth)
      .send({ importId: preview.body.data.id });

    const activityCount = await ActivityRecord.countDocuments({
      courseId,
    });
    expect(activityCount).toBe(9);

    const generated = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });

    expect(generated.status).toBe(201);
    expect(generated.body.data.generatedCount).toBe(9);
    expect(generated.body.data.counts.INSUFFICIENT_DATA).toBe(0);
    expect(generated.body.data.counts.ACTIVE).toBe(9);
    expect(generated.body.data.period.monitoringPeriodEnd).toContain("2026-11-10");

    for (const item of generated.body.data.items) {
      expect(item.classification).not.toBe("INSUFFICIENT_DATA");
      expect(item.activityRecordId).toBeTruthy();
      expect(item.displayScore).not.toBeNull();
    }

    const dashboard = await request(app)
      .get(`/api/v1/courses/${courseId}/dashboard`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-11-10" })
      .set(auth);
    expect(dashboard.body.data.activityImportUsed).toBeTruthy();
    expect(dashboard.body.data.activityImportUsed.importedCount).toBeGreaterThanOrEqual(9);

    const runsExact = await request(app)
      .get(`/api/v1/courses/${courseId}/classification-runs`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-11-10" })
      .set(auth);
    expect(runsExact.status).toBe(200);
    expect(runsExact.body.data.items).toHaveLength(1);
    expect(runsExact.body.data.items[0].runId).toBe(generated.body.data.runId);
    expect(runsExact.body.data.periodAdjusted).toBe(false);
    expect(String(runsExact.body.data.items[0].monitoringPeriodEnd)).toContain("2026-11-10");

    const runsUrlPeriod = await request(app)
      .get(`/api/v1/courses/${courseId}/classification-runs`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31" })
      .set(auth);
    expect(runsUrlPeriod.status).toBe(200);
    expect(runsUrlPeriod.body.data.periodAdjusted).toBe(true);
    expect(runsUrlPeriod.body.data.items).toHaveLength(1);
    expect(runsUrlPeriod.body.data.items[0].runId).toBe(generated.body.data.runId);
    expect(String(runsUrlPeriod.body.data.items[0].monitoringPeriodEnd)).toContain("2026-11-10");
  },
  120_000);

  test("dashboard exposes latest confirmed import when URL period does not match import", async () => {
    const { token, courseId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const dashboard = await request(app)
      .get(`/api/v1/courses/${courseId}/dashboard`)
      .query({ periodStart: "2026-01-01", periodEnd: "2026-01-31" })
      .set(auth);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.latestImport).toBeTruthy();
    expect(dashboard.body.data.latestImport.filename).toBe("activity.csv");
    expect(dashboard.body.data.latestImport.monitoringPeriodStart).toBe("2026-10-01");
    expect(dashboard.body.data.latestImport.monitoringPeriodEnd).toBe("2026-10-31");
    expect(dashboard.body.data.effectivePeriod.monitoringPeriodStart).toBe("2026-10-01");
    expect(dashboard.body.data.effectivePeriod.monitoringPeriodEnd).toBe("2026-10-31");
  });

  test("course roster shows classifications when URL period does not match saved run", async () => {
    const { token, courseId, highId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });

    const roster = await request(app)
      .get(`/api/v1/courses/${courseId}/students`)
      .query({ periodStart: "2026-01-01", periodEnd: "2026-01-31" })
      .set(auth);

    expect(roster.status).toBe(200);
    const high = roster.body.data.items.find((item) => item.studentId === highId);
    expect(high).toBeTruthy();
    expect(high.classification).toBe("ACTIVE");
    expect(high.displayScore).toBe(84);
    expect(high.lastActivityAt).toBeTruthy();
  });

  test(
    "generate uses latest confirmed import without matching request period",
    async () => {
    const { token, courseId, highId } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const generated = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "January Run", monitoringPeriodStart: "2026-01-01", monitoringPeriodEnd: "2026-01-31" });

    expect(generated.status).toBe(201);
    expect(generated.body.data.generatedCount).toBe(2);
    const high = generated.body.data.items.find((item) => item.studentId === highId);
    expect(high.classification).toBe("ACTIVE");
    expect(high.activityRecordId).toBeTruthy();
  },
  60_000);
});
