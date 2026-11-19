import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ClassificationConfig from "../src/models/ClassificationConfig.js";
import Course from "../src/models/Course.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "phase4-test-";

async function seed() {
  const email = `${PREFIX}${Date.now()}@example.com`;
  const auth = await request(app).post("/api/v1/auth/register").send({
    fullName: "Config Lecturer",
    email,
    password: "securePass1",
  });
  const token = auth.body.data.token;
  const code = `P4${Date.now().toString().slice(-6)}`;
  const course = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Config Course", code });
  return { token, courseId: course.body.data.course.id, email };
}

describe("classification configuration", () => {
  let mongoReady = false;

  beforeAll(async () => {
    try {
      await connectDatabase(env.mongodbUri);
      mongoReady = true;
    } catch (error) {
      console.warn(`Skipping classification-config Mongo tests: ${error.message}`);
    }
  }, 120000);

  afterAll(async () => {
    if (mongoReady) {
      const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id");
      const courses = await Course.find({ lecturerId: { $in: users.map((row) => row._id) } }).select("_id");
      await ClassificationConfig.deleteMany({ courseId: { $in: courses.map((row) => row._id) } });
      await Course.deleteMany({ _id: { $in: courses.map((row) => row._id) } });
      await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    }
    await disconnectDatabase();
  });

  test(
    "GET seeds default v1 and POST creates an immutable new version",
    async () => {
      if (!mongoReady) {
        return;
      }
      const { token, courseId } = await seed();
      const auth = { Authorization: `Bearer ${token}` };

      const first = await request(app).get(`/api/v1/courses/${courseId}/classification-config`).set(auth);
      expect(first.status).toBe(200);
      expect(first.body.data.config.version).toBe(1);
      expect(first.body.data.config.isActive).toBe(true);
      expect(first.body.data.config.weights.lastActivity).toBe(0.3);
      expect(first.body.data.config.classificationBoundaries.activeMin).toBe(70);

      const created = await request(app)
        .post(`/api/v1/courses/${courseId}/classification-config`)
        .set(auth)
        .send({
          classificationBoundaries: { requiringAttentionMin: 45, activeMin: 75 },
          lastActivityBands: [
            { minDays: 0, maxDays: 3, score: 100 },
            { minDays: 4, maxDays: 7, score: 80 },
            { minDays: 8, maxDays: 14, score: 60 },
            { minDays: 15, maxDays: 21, score: 30 },
            { minDays: 22, maxDays: null, score: 0 },
          ],
          changeNote: "Tighter boundaries",
        });

      expect(created.status).toBe(201);
      expect(created.body.data.config.version).toBe(2);
      expect(created.body.data.config.isActive).toBe(true);
      expect(created.body.data.config.classificationBoundaries.activeMin).toBe(75);
      expect(created.body.data.config.changeNote).toBe("Tighter boundaries");

      const active = await request(app).get(`/api/v1/courses/${courseId}/classification-config`).set(auth);
      expect(active.body.data.config.version).toBe(2);

      const versions = await request(app)
        .get(`/api/v1/courses/${courseId}/classification-config/versions`)
        .set(auth);
      expect(versions.status).toBe(200);
      expect(versions.body.data.versions).toHaveLength(2);
      const v1 = versions.body.data.versions.find((item) => item.version === 1);
      const v2 = versions.body.data.versions.find((item) => item.version === 2);
      expect(v1.isActive).toBe(false);
      expect(v2.isActive).toBe(true);
    },
    120000
  );

  test(
    "course config rejects inline weights",
    async () => {
      if (!mongoReady) {
        return;
      }
      const { token, courseId } = await seed();
      const response = await request(app)
        .post(`/api/v1/courses/${courseId}/classification-config`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          weights: { lastActivity: 30, materialAccess: 30, assignmentSubmission: 30 },
          classificationBoundaries: { requiringAttentionMin: 40, activeMin: 70 },
        });
      expect(response.status).toBe(400);
    },
    120000
  );
});
