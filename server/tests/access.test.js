import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ClassificationResult from "../src/models/ClassificationResult.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "phase6-test-";

async function registerLecturer(suffix) {
  const email = `${PREFIX}${Date.now()}-${suffix}@example.com`;
  const response = await request(app).post("/api/v1/auth/register").send({
    fullName: `Access ${suffix}`,
    email,
    password: "securePass1",
  });
  return { token: response.body.data.token, email };
}

describe("access control and dashboard filters", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id");
    const courses = await Course.find({ lecturerId: { $in: users.map((row) => row._id) } }).select("_id");
    const courseIds = courses.map((row) => row._id);
    await ClassificationResult.deleteMany({ courseId: { $in: courseIds } });
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ _id: { $in: courseIds } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^P6/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  });

  test("lecturer B cannot generate or read lecturer A's dashboard", async () => {
    const lecturerA = await registerLecturer("a");
    const lecturerB = await registerLecturer("b");
    const course = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${lecturerA.token}`)
      .send({ name: "Private Results", code: `P6${Date.now().toString().slice(-6)}` });
    const courseId = course.body.data.course.id;

    const generate = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set("Authorization", `Bearer ${lecturerB.token}`)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    expect(generate.status).toBe(404);

    const dashboard = await request(app)
      .get(`/api/v1/courses/${courseId}/dashboard`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31" })
      .set("Authorization", `Bearer ${lecturerB.token}`);
    expect(dashboard.status).toBe(404);
  });

  test("dashboard search and classification filter apply to the table only", async () => {
    const { token } = await registerLecturer("filter");
    const auth = { Authorization: `Bearer ${token}` };
    const course = await request(app)
      .post("/api/v1/courses")
      .set(auth)
      .send({ name: "Filter Course", code: `P6${Date.now().toString().slice(-5)}F` });
    const courseId = course.body.data.course.id;

    const alpha = await request(app)
      .post("/api/v1/students")
      .set(auth)
      .send({ fullName: "Alpha Filter", matriculationNumber: `P6${Date.now().toString().slice(-7)}A` });
    const beta = await request(app)
      .post("/api/v1/students")
      .set(auth)
      .send({ fullName: "Beta Filter", matriculationNumber: `P6${Date.now().toString().slice(-7)}B` });
    await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments`)
      .set(auth)
      .send({ studentId: alpha.body.data.student.id });
    await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments`)
      .set(auth)
      .send({ studentId: beta.body.data.student.id });

    const alphaMatric = alpha.body.data.student.matriculationNumber;
    const activityCsv = Buffer.from(
      [
        "studentIdentifier,studentName,lastActivityAt,materialsAvailable,materialsAccessed,assignmentsDue,assignmentsSubmitted,monitoringPeriodStart,monitoringPeriodEnd",
        `${alphaMatric},Alpha Filter,2026-10-29,10,8,4,3,2026-10-01,2026-10-31`,
      ].join("\n"),
      "utf8",
    );
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

    const generated = await request(app)
      .post(`/api/v1/courses/${courseId}/classifications/generate`)
      .set(auth)
      .send({ runName: "October Run", monitoringPeriodStart: "2026-10-01", monitoringPeriodEnd: "2026-10-31" });
    expect(generated.status).toBe(201);

    const searched = await request(app)
      .get(`/api/v1/courses/${courseId}/dashboard`)
      .query({ periodStart: "2026-10-01", periodEnd: "2026-10-31", q: "Alpha" })
      .set(auth);
    expect(searched.status).toBe(200);
    expect(searched.body.data.counts.ACTIVE).toBe(1);
    expect(searched.body.data.counts.INSUFFICIENT_DATA).toBe(1);
    expect(searched.body.data.results.total).toBe(1);
    expect(searched.body.data.results.items[0].student.fullName).toBe("Alpha Filter");

    const filtered = await request(app)
      .get(`/api/v1/courses/${courseId}/dashboard`)
      .query({
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        classification: "INSUFFICIENT_DATA",
      })
      .set(auth);
    expect(filtered.body.data.results.total).toBe(1);
    expect(filtered.body.data.results.items[0].student.fullName).toBe("Beta Filter");
  });
});
