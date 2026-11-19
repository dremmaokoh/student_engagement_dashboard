import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Student from "../src/models/Student.js";
import StudentCommunication from "../src/models/StudentCommunication.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "comm-test-";

async function registerLecturer() {
  const email = `${PREFIX}${Date.now()}@example.com`;
  const response = await request(app).post("/api/v1/auth/register").send({
    fullName: "Comm Lecturer",
    email,
    password: "securePass1",
  });
  return { token: response.body.data.token, email, userId: response.body.data.user.id };
}

describe("student email and communications", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    const users = await User.find({ email: { $regex: `^${PREFIX}` } }).select("_id email");
    const courses = await Course.find({ lecturerId: { $in: users.map((row) => row._id) } }).select("_id");
    const courseIds = courses.map((row) => row._id);
    await StudentCommunication.deleteMany({ lecturerId: { $in: users.map((row) => row._id) } });
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ _id: { $in: courseIds } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^COMM(?:LEG|S)?\d+$/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  });

  test("roster import saves student email and rejects invalid addresses in preview", async () => {
    const { token } = await registerLecturer();
    const auth = { Authorization: `Bearer ${token}` };
    const stamp = Date.now().toString().slice(-5);
    const code = `RC${stamp}`;

    const validCsv = [
      "courseCode,courseName,studentIdentifier,studentName,studentEmail",
      `${code},Roster Course,COMM${stamp},Ada Student,ada${stamp}@example.com`,
    ].join("\n");

    const preview = await request(app)
      .post("/api/v1/courses/import-roster/preview")
      .set(auth)
      .attach("file", Buffer.from(validCsv, "utf8"), "roster.csv");
    expect(preview.status).toBe(201);
    expect(preview.body.data.summary.validRows).toBe(1);

    const invalidCsv = [
      "courseCode,courseName,studentIdentifier,studentName,studentEmail",
      `${code},Roster Course,COMMX${stamp},Bad Email,not-an-email`,
    ].join("\n");
    const badPreview = await request(app)
      .post("/api/v1/courses/import-roster/preview")
      .set(auth)
      .attach("file", Buffer.from(invalidCsv, "utf8"), "bad.csv");
    expect(badPreview.status).toBe(201);
    expect(badPreview.body.data.summary.invalidRows).toBe(1);
    expect(badPreview.body.data.invalidRows[0].errors.join(" ")).toMatch(/invalid/i);

    await request(app)
      .post("/api/v1/courses/import-roster/confirm")
      .set(auth)
      .send({ importId: preview.body.data.importId });

    const student = await Student.findOne({ matriculationNumber: `COMM${stamp}` });
    expect(student?.email).toBe(`ada${stamp}@example.com`);
  });

  test("legacy four-column roster CSV still imports", async () => {
    const { token } = await registerLecturer();
    const auth = { Authorization: `Bearer ${token}` };
    const stamp = Date.now().toString().slice(-4);
    const csv = [
      "courseCode,courseName,studentIdentifier,studentName",
      `L4${stamp},Legacy Course,COMMLEG${stamp},Legacy Student`,
    ].join("\n");
    const preview = await request(app)
      .post("/api/v1/courses/import-roster/preview")
      .set(auth)
      .attach("file", Buffer.from(csv, "utf8"), "legacy.csv");
    expect(preview.status).toBe(201);
    await request(app)
      .post("/api/v1/courses/import-roster/confirm")
      .set(auth)
      .send({ importId: preview.body.data.importId });
    const student = await Student.findOne({ matriculationNumber: `COMMLEG${stamp}` });
    expect(student?.fullName).toBe("Legacy Student");
  });

  test("send message records history and returns not_configured when mail delivery is disabled", async () => {
    const { token, email: lecturerEmail } = await registerLecturer();
    const auth = { Authorization: `Bearer ${token}` };
    const stamp = Date.now().toString().slice(-5);

    const course = await request(app)
      .post("/api/v1/courses")
      .set(auth)
      .send({ name: "Comm Course", code: `CC${stamp}` });
    const courseId = course.body.data.course.id;

    const studentRes = await request(app)
      .post("/api/v1/students")
      .set(auth)
      .send({
        fullName: "Comm Student",
        matriculationNumber: `COMMS${stamp}`,
        email: `comm${stamp}@example.com`,
      });
    const studentId = studentRes.body.data.student.id;

    await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments`)
      .set(auth)
      .send({ studentId });

    const empty = await request(app).get(`/api/v1/students/${studentId}/communications`).set(auth);
    expect(empty.status).toBe(200);
    expect(empty.body.data.items).toEqual([]);

    const send = await request(app)
      .post(`/api/v1/students/${studentId}/communications`)
      .set(auth)
      .send({
        subject: "Follow-up",
        message: "Please check in regarding course activity.",
        courseId,
      });

    expect(send.status).toBe(503);
    expect(send.body.message).toMatch(/not configured/i);
    const communication = send.body.communication;
    expect(communication).toBeDefined();
    expect(communication.status).toBe("not_configured");
    expect(communication.errorMessage).toMatch(/not configured/i);
    expect(communication.providerMessageId).toBeNull();
    expect(communication.subject).toBe("Follow-up");
    expect(communication.replyToEmail).toBe(lecturerEmail.toLowerCase());
    expect(communication.toEmail).toBe(`comm${stamp}@example.com`);

    const history = await request(app).get(`/api/v1/students/${studentId}/communications`).set(auth);
    expect(history.status).toBe(200);
    expect(history.body.data.items.length).toBeGreaterThanOrEqual(1);

    const profile = await request(app).get(`/api/v1/students/${studentId}`).set(auth);
    expect(profile.body.data.student.email).toBe(`comm${stamp}@example.com`);

    const patch = await request(app)
      .patch(`/api/v1/students/${studentId}`)
      .set(auth)
      .send({ email: `updated${stamp}@example.com` });
    expect(patch.status).toBe(200);
    expect(patch.body.data.student.email).toBe(`updated${stamp}@example.com`);
  });
});