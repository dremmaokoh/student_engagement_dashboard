import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const app = createApp();
const PREFIX = "phase2-test-";

function unique(suffix) {
  return `${PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}-${suffix}`;
}

async function registerLecturer() {
  const email = `${unique("lec")}@example.com`;
  const response = await request(app).post("/api/v1/auth/register").send({
    fullName: "Phase Two Lecturer",
    email,
    password: "securePass1",
  });
  return { email, token: response.body.data.token };
}

describe("courses, students and enrolments", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    const testCourses = await Course.find({ code: { $regex: /^P2/ } }).select("_id");
    await Enrollment.deleteMany({ courseId: { $in: testCourses.map((row) => row._id) } });
    await Course.deleteMany({ code: { $regex: /^P2/ } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^P2/ } });
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } });
    await disconnectDatabase();
  });

  test("lecturer can create a course, add a student and enrol them", async () => {
    const { token } = await registerLecturer();
    const code = `P2${Date.now().toString().slice(-6)}`;

    const created = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Software Engineering",
        code,
        description: "Phase 2 course",
      });

    expect(created.status).toBe(201);
    const courseId = created.body.data.course.id;

    const listed = await request(app)
      .get("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.some((item) => item.id === courseId)).toBe(true);
    expect(listed.body.data.page).toBe(1);

    const student = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Ada Student",
        matriculationNumber: `P2${Date.now().toString().slice(-8)}`,
        email: `${unique("stu")}@example.com`,
      });
    expect(student.status).toBe(201);
    const studentId = student.body.data.student.id;

    const enrolled = await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId });
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.data.enrollment.status).toBe("active");

    const courseStudents = await request(app)
      .get(`/api/v1/courses/${courseId}/students`)
      .set("Authorization", `Bearer ${token}`);
    expect(courseStudents.body.data.items).toHaveLength(1);
    expect(courseStudents.body.data.items[0].student.id).toBe(studentId);

    const profile = await request(app)
      .get(`/api/v1/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.student.id).toBe(studentId);
    expect(profile.body.data.student.courses).toHaveLength(1);
    expect(profile.body.data.student.courseResults).toHaveLength(1);
    expect(profile.body.data.student.courseResults[0].course.id).toBe(courseId);
  });

  test("duplicate active enrolment is rejected", async () => {
    const { token } = await registerLecturer();
    const code = `P2${Date.now().toString().slice(-6)}A`;
    const course = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Duplicate Enrol", code });
    const student = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Dup Student",
        matriculationNumber: `P2${Date.now().toString().slice(-8)}D`,
      });

    await request(app)
      .post(`/api/v1/courses/${course.body.data.course.id}/enrollments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: student.body.data.student.id });

    const again = await request(app)
      .post(`/api/v1/courses/${course.body.data.course.id}/enrollments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: student.body.data.student.id });

    expect(again.status).toBe(409);
  });

  test("lecturer A cannot access lecturer B's course", async () => {
    const lecturerA = await registerLecturer();
    const lecturerB = await registerLecturer();
    const course = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${lecturerA.token}`)
      .send({ name: "Private Course", code: `P2${Date.now().toString().slice(-6)}B` });

    const response = await request(app)
      .get(`/api/v1/courses/${course.body.data.course.id}`)
      .set("Authorization", `Bearer ${lecturerB.token}`);

    expect(response.status).toBe(404);
  });

  test("delete archives a course instead of removing it", async () => {
    const { token } = await registerLecturer();
    const course = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Archive Me", code: `P2${Date.now().toString().slice(-6)}C` });

    const archived = await request(app)
      .delete(`/api/v1/courses/${course.body.data.course.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(archived.status).toBe(200);
    expect(archived.body.data.course.status).toBe("archived");

    const listed = await request(app)
      .get("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`);
    expect(listed.body.data.items.some((item) => item.id === course.body.data.course.id)).toBe(
      false,
    );
  });

  test("unauthenticated course requests are rejected", async () => {
    const response = await request(app).get("/api/v1/courses");
    expect(response.status).toBe(401);
  });

  test("course enrolment template lists lecturer courses with empty student cells", async () => {
    const { token } = await registerLecturer();
    const code = `R${Date.now().toString().slice(-6)}`;
    await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Roster Template Course", code });

    const response = await request(app)
      .get("/api/v1/courses/import-roster/template")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/csv/);
    const lines = response.text.trim().split("\n");
    expect(lines[0]).toBe("courseCode,courseName,studentIdentifier,studentName,studentEmail");
    expect(lines.some((line) => line.startsWith(`${code},Roster Template Course,,,`))).toBe(true);
    expect(lines.some((line) => line.includes("MVA001"))).toBe(false);
  });
});
