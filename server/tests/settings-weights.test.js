import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import Course from "../src/models/Course.js";
import LecturerIndicatorWeights from "../src/models/LecturerIndicatorWeights.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "settings-weights-test-";

async function seed() {
  const email = `${PREFIX}${Date.now()}@example.com`;
  const auth = await request(app).post("/api/v1/auth/register").send({
    fullName: "Weights Lecturer",
    email,
    password: "securePass1",
  });
  const token = auth.body.data.token;
  const code = `SW${Date.now().toString().slice(-6)}`;
  await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Weights Course", code });
  return { token, email };
}

describe("global indicator weights", () => {
  let mongoReady = false;

  beforeAll(async () => {
    try {
      await connectDatabase(env.mongodbUri);
      mongoReady = true;
    } catch (error) {
      console.warn(`Skipping settings-weights Mongo tests: ${error.message}`);
    }
  }, 120000);

  afterAll(async () => {
    if (mongoReady) {
      const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id");
      await LecturerIndicatorWeights.deleteMany({ lecturerId: { $in: users.map((row) => row._id) } });
      await Course.deleteMany({ lecturerId: { $in: users.map((row) => row._id) } });
      await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    }
    await disconnectDatabase();
  });

  test("GET seeds default 30/30/40 and POST creates a new active version", async () => {
    if (!mongoReady) {
      return;
    }
    const { token } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const first = await request(app).get("/api/v1/settings/indicator-weights").set(auth);
    expect(first.status).toBe(200);
    expect(first.body.data.weights.weights.lastActivity).toBe(0.3);
    expect(first.body.data.weights.weights.assignmentSubmission).toBe(0.4);

    const saved = await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set(auth)
      .send({
        weights: { lastActivity: 25, materialAccess: 35, assignmentSubmission: 40 },
        changeNote: "More material emphasis",
      });
    expect(saved.status).toBe(201);
    expect(saved.body.data.weights.version).toBe(2);
    expect(saved.body.data.weights.weights.materialAccess).toBe(0.35);

    const active = await request(app).get("/api/v1/settings/indicator-weights").set(auth);
    expect(active.body.data.weights.version).toBe(2);
    expect(active.body.data.weights.activeIndicators).toEqual({
      lastActivity: true,
      materialAccess: true,
      assignmentSubmission: true,
    });
  }, 120000);

  test("invalid global weights are rejected", async () => {
    if (!mongoReady) {
      return;
    }
    const { token } = await seed();
    const response = await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set("Authorization", `Bearer ${token}`)
      .send({ weights: { lastActivity: 30, materialAccess: 30, assignmentSubmission: 30 } });
    expect(response.status).toBe(400);
  }, 120000);

  test("two active indicators can be saved and earlier versions stay unchanged", async () => {
    if (!mongoReady) {
      return;
    }
    const { token } = await seed();
    const auth = { Authorization: `Bearer ${token}` };
    const seeded = await request(app).get("/api/v1/settings/indicator-weights").set(auth);
    expect(seeded.body.data.weights.activeIndicators.materialAccess).toBe(true);

    const saved = await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set(auth)
      .send({
        weights: { lastActivity: 40, materialAccess: 30, assignmentSubmission: 60 },
        activeIndicators: { lastActivity: true, materialAccess: false, assignmentSubmission: true },
        changeNote: "Drop material completion",
      });
    expect(saved.status).toBe(201);
    expect(saved.body.data.weights.version).toBe(2);
    expect(saved.body.data.weights.activeIndicators.materialAccess).toBe(false);
    expect(saved.body.data.weights.weights.lastActivity).toBeCloseTo(0.4);
    expect(saved.body.data.weights.weights.assignmentSubmission).toBeCloseTo(0.6);

    const history = await request(app).get("/api/v1/settings/indicator-weights/versions").set(auth);
    expect(history.status).toBe(200);
    const versions = history.body.data.versions || history.body.data.items || history.body.data;
    const list = Array.isArray(versions) ? versions : versions.versions;
    const original = list.find((row) => row.version === 1);
    const latest = list.find((row) => row.version === 2);
    expect(original.activeIndicators.materialAccess).toBe(true);
    expect(original.weights.materialAccess).toBeCloseTo(0.3);
    expect(latest.activeIndicators).toEqual({
      lastActivity: true,
      materialAccess: false,
      assignmentSubmission: true,
    });
  }, 120000);

  test("fewer than two active indicators is rejected", async () => {
    if (!mongoReady) {
      return;
    }
    const { token } = await seed();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).get("/api/v1/settings/indicator-weights").set(auth);

    const one = await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set(auth)
      .send({
        weights: { lastActivity: 100, materialAccess: 0, assignmentSubmission: 0 },
        activeIndicators: { lastActivity: true, materialAccess: false, assignmentSubmission: false },
      });
    expect(one.status).toBe(400);
    expect(one.body.message || one.body.error || "").toMatch(/at least two indicators/i);

    const none = await request(app)
      .post("/api/v1/settings/indicator-weights")
      .set(auth)
      .send({
        weights: { lastActivity: 0, materialAccess: 0, assignmentSubmission: 0 },
        activeIndicators: { lastActivity: false, materialAccess: false, assignmentSubmission: false },
      });
    expect(none.status).toBe(400);
    expect(none.body.message || none.body.error || "").toMatch(/at least two indicators/i);

    const stillDefault = await request(app).get("/api/v1/settings/indicator-weights").set(auth);
    expect(stillDefault.body.data.weights.version).toBe(1);
  }, 120000);
});