import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ClassificationResult from "../src/models/ClassificationResult.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import ImportBatch from "../src/models/ImportBatch.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "attention-test-";
const PERIOD_A = { periodStart: "2026-09-01", periodEnd: "2026-09-30" };
const PERIOD_B = { periodStart: "2026-10-01", periodEnd: "2026-10-31" };

async function createCourseContext(label) {
  const email = `${PREFIX}${label}-${Date.now()}@example.com`;
  const registered = await request(app).post("/api/v1/auth/register").send({
    fullName: "Attention Lecturer",
    email,
    password: "securePass1",
  });
  expect(registered.status).toBe(201);

  const token = registered.body.data.token;
  const auth = { Authorization: `Bearer ${token}` };
  const lecturerId = registered.body.data.user.id;
  const created = await request(app)
    .post("/api/v1/courses")
    .set(auth)
    .send({
      name: `Attention Course ${label}`,
      code: `AT${Date.now().toString().slice(-6)}${label.slice(0, 2).toUpperCase()}`,
    });
  expect(created.status).toBe(201);

  return { auth, courseId: created.body.data.course.id, lecturerId };
}

async function addStudents(context, classifications, matricPrefix) {
  const students = await Student.insertMany(
    classifications.map((_, index) => ({
      fullName: `Attention Student ${index + 1}`,
      matriculationNumber: `${matricPrefix}${index}`,
    })),
  );
  await Enrollment.insertMany(
    students.map((student) => ({ studentId: student._id, courseId: context.courseId, status: "active" })),
  );
  return students.map((student) => String(student._id));
}

function scoreFor(classification, index) {
  if (classification === "INSUFFICIENT_DATA") {
    return null;
  }
  if (classification === "INACTIVE") {
    return 5 + index;
  }
  if (classification === "REQUIRING_ATTENTION") {
    return 45 + index;
  }
  return 90;
}

async function insertRun(context, studentIds, classifications, options) {
  const runId = new mongoose.Types.ObjectId();
  const configurationId = new mongoose.Types.ObjectId();
  const generatedAt = new Date(options.generatedAt);
  const docs = classifications.map((classification, index) => {
    const score = scoreFor(classification, index);
    return {
      studentId: studentIds[index],
      courseId: context.courseId,
      runId,
      runName: options.runName,
      monitoringPeriodStart: new Date(options.periodStart),
      monitoringPeriodEnd: new Date(options.periodEnd),
      indicators: {},
      configuredWeights: {},
      effectiveWeights: {},
      overallScore: score,
      displayScore: score,
      classification,
      configurationId,
      configurationVersion: 1,
      configurationSnapshot: {},
      explanation: { overall: "Seeded for dashboard consistency test" },
      activitySnapshot: null,
      generatedAt,
      generatedBy: context.lecturerId,
    };
  });
  await ClassificationResult.insertMany(docs);
  return String(runId);
}

async function getRuns(context, query) {
  const response = await request(app)
    .get(`/api/v1/courses/${context.courseId}/classification-runs`)
    .query(query)
    .set(context.auth);
  expect(response.status).toBe(200);
  return response.body.data.items;
}

async function getDashboard(context, query) {
  const response = await request(app)
    .get(`/api/v1/courses/${context.courseId}/dashboard`)
    .query(query)
    .set(context.auth);
  expect(response.status).toBe(200);
  return response.body.data;
}

async function getAttentionDashboards(context, period, runId) {
  const [inactive, requiringAttention] = await Promise.all([
    getDashboard(context, { ...period, runId, classification: "INACTIVE", limit: 5, page: 1 }),
    getDashboard(context, { ...period, runId, classification: "REQUIRING_ATTENTION", limit: 5, page: 1 }),
  ]);
  return [inactive, requiringAttention];
}

function combinedItems(dashboards) {
  return dashboards.flatMap((dashboard) => dashboard.results.items);
}

describe("course overview students needing attention", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id");
    const courses = await Course.find({ lecturerId: { $in: users.map((user) => user._id) } }).select("_id");
    const courseIds = courses.map((course) => course._id);
    await ClassificationResult.deleteMany({ courseId: { $in: courseIds } });
    await ImportBatch.deleteMany({ courseId: { $in: courseIds } });
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ _id: { $in: courseIds } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^ATT/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  });

  test("A: inactive students are returned before pagination when they follow insufficient data", async () => {
    const context = await createCourseContext("a");
    const classifications = [
      ...Array(30).fill("INSUFFICIENT_DATA"),
      ...Array(6).fill("INACTIVE"),
    ];
    const studentIds = await addStudents(context, classifications, `ATTA${Date.now().toString().slice(-5)}`);
    const runId = await insertRun(context, studentIds, classifications, {
      ...PERIOD_A,
      runName: "Inactive Run",
      generatedAt: "2026-09-30T12:00:00.000Z",
    });

    const runs = await getRuns(context, { scope: "all" });
    expect(runs[0].runId).toBe(runId);
    expect(runs[0].counts.INACTIVE).toBe(6);
    expect(runs[0].counts.INSUFFICIENT_DATA).toBe(30);

    const dashboards = await getAttentionDashboards(context, PERIOD_A, runId);
    expect(dashboards[0].results.total).toBe(6);
    expect(dashboards[1].results.total).toBe(0);
    expect(combinedItems(dashboards)).toHaveLength(5);
    expect(combinedItems(dashboards).every((item) => item.classification === "INACTIVE")).toBe(true);
  });

  test("B: requiring attention students are returned even with many null-score records", async () => {
    const context = await createCourseContext("b");
    const classifications = [
      ...Array(40).fill("INSUFFICIENT_DATA"),
      ...Array(4).fill("REQUIRING_ATTENTION"),
    ];
    const studentIds = await addStudents(context, classifications, `ATTB${Date.now().toString().slice(-5)}`);
    const runId = await insertRun(context, studentIds, classifications, {
      ...PERIOD_A,
      runName: "Attention Run",
      generatedAt: "2026-09-30T12:00:00.000Z",
    });

    const dashboards = await getAttentionDashboards(context, PERIOD_A, runId);
    expect(dashboards[0].results.total).toBe(0);
    expect(dashboards[1].results.total).toBe(4);
    expect(combinedItems(dashboards)).toHaveLength(4);
    expect(combinedItems(dashboards).every((item) => item.classification === "REQUIRING_ATTENTION")).toBe(true);
  });

  test("C: both qualifying classifications are available to the attention list", async () => {
    const context = await createCourseContext("c");
    const classifications = [
      ...Array(20).fill("INACTIVE"),
      ...Array(20).fill("REQUIRING_ATTENTION"),
      ...Array(10).fill("ACTIVE"),
    ];
    const studentIds = await addStudents(context, classifications, `ATTC${Date.now().toString().slice(-5)}`);
    const runId = await insertRun(context, studentIds, classifications, {
      ...PERIOD_A,
      runName: "Both Run",
      generatedAt: "2026-09-30T12:00:00.000Z",
    });

    const dashboards = await getAttentionDashboards(context, PERIOD_A, runId);
    expect(dashboards[0].results.total).toBe(20);
    expect(dashboards[1].results.total).toBe(20);
    const items = combinedItems(dashboards);
    expect(items.some((item) => item.classification === "INACTIVE")).toBe(true);
    expect(items.some((item) => item.classification === "REQUIRING_ATTENTION")).toBe(true);
    expect(items.every((item) => ["INACTIVE", "REQUIRING_ATTENTION"].includes(item.classification))).toBe(true);

    const multiFilter = await getDashboard(context, {
      ...PERIOD_A,
      runId,
      classification: "Inactive,Requiring Attention",
      limit: 5,
      page: 1,
    });
    expect(multiFilter.results.total).toBe(40);
    expect(multiFilter.results.items.every((item) => ["INACTIVE", "REQUIRING_ATTENTION"].includes(item.classification))).toBe(
      true,
    );
  });

  test("D: no qualifying records means both attention queries are empty", async () => {
    const context = await createCourseContext("d");
    const classifications = [...Array(10).fill("ACTIVE"), ...Array(10).fill("INSUFFICIENT_DATA")];
    const studentIds = await addStudents(context, classifications, `ATTD${Date.now().toString().slice(-5)}`);
    const runId = await insertRun(context, studentIds, classifications, {
      ...PERIOD_A,
      runName: "No Attention Run",
      generatedAt: "2026-09-30T12:00:00.000Z",
    });

    const dashboards = await getAttentionDashboards(context, PERIOD_A, runId);
    expect(combinedItems(dashboards)).toEqual([]);
    expect(dashboards[0].results.total).toBe(0);
    expect(dashboards[1].results.total).toBe(0);
  });

  test("E: each monitoring period selects its own summary and student records", async () => {
    const context = await createCourseContext("e");
    const first = [...Array(3).fill("INACTIVE")];
    const second = [...Array(2).fill("REQUIRING_ATTENTION")];
    const studentIds = await addStudents(context, [...first, ...second], `ATTE${Date.now().toString().slice(-5)}`);
    const firstRun = await insertRun(context, studentIds.slice(0, 3), first, {
      ...PERIOD_A,
      runName: "September Run",
      generatedAt: "2026-09-30T12:00:00.000Z",
    });
    const secondRun = await insertRun(context, studentIds.slice(3), second, {
      ...PERIOD_B,
      runName: "October Run",
      generatedAt: "2026-10-31T12:00:00.000Z",
    });

    const septemberRuns = await getRuns(context, PERIOD_A);
    const octoberRuns = await getRuns(context, PERIOD_B);
    expect(septemberRuns[0].runId).toBe(firstRun);
    expect(octoberRuns[0].runId).toBe(secondRun);
    expect(septemberRuns[0].counts.INACTIVE).toBe(3);
    expect(octoberRuns[0].counts.REQUIRING_ATTENTION).toBe(2);

    const septemberDashboards = await getAttentionDashboards(context, PERIOD_A, firstRun);
    const octoberDashboards = await getAttentionDashboards(context, PERIOD_B, secondRun);
    expect(combinedItems(septemberDashboards).map((item) => item.classification)).toEqual([
      "INACTIVE",
      "INACTIVE",
      "INACTIVE",
    ]);
    expect(combinedItems(octoberDashboards).map((item) => item.classification)).toEqual([
      "REQUIRING_ATTENTION",
      "REQUIRING_ATTENTION",
    ]);
  });

  test("F: the latest run is used for both counts and student records", async () => {
    const context = await createCourseContext("f");
    const classifications = [...Array(4).fill("INACTIVE")];
    const studentIds = await addStudents(context, classifications, `ATTF${Date.now().toString().slice(-5)}`);
    const olderRun = await insertRun(context, studentIds, classifications, {
      ...PERIOD_A,
      runName: "Older Run",
      generatedAt: "2026-09-20T12:00:00.000Z",
    });
    const newerClassifications = [...Array(4).fill("REQUIRING_ATTENTION")];
    const newerRun = await insertRun(context, studentIds, newerClassifications, {
      ...PERIOD_A,
      runName: "Newer Run",
      generatedAt: "2026-09-29T12:00:00.000Z",
    });

    const runs = await getRuns(context, { scope: "all" });
    expect(runs[0].runId).toBe(newerRun);
    expect(runs[0].counts.REQUIRING_ATTENTION).toBe(4);
    expect(runs[0].counts.INACTIVE).toBe(0);

    const latestDashboards = await getAttentionDashboards(context, PERIOD_A, runs[0].runId);
    expect(combinedItems(latestDashboards).map((item) => item.classification)).toEqual([
      "REQUIRING_ATTENTION",
      "REQUIRING_ATTENTION",
      "REQUIRING_ATTENTION",
      "REQUIRING_ATTENTION",
    ]);

    const olderDashboards = await getAttentionDashboards(context, PERIOD_A, olderRun);
    expect(combinedItems(olderDashboards).every((item) => item.classification === "INACTIVE")).toBe(true);
  });
});
