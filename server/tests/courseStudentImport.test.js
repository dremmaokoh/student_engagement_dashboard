import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const app = createApp();
const USER_PREFIX = "csitest-";
const CODE_PREFIX = "CSI";

function suffix() {
  return `${Date.now().toString().slice(-7)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

function csv(lines) {
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

async function seedCourse() {
  const stamp = suffix();
  const auth = await request(app).post("/api/v1/auth/register").send({
    fullName: "Course Student Import Lecturer",
    email: `${USER_PREFIX}${stamp.toLowerCase()}@example.com`,
    password: "securePass1",
  });
  const token = auth.body.data.token;
  const course = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Course Student Import", code: `${CODE_PREFIX}${stamp}` });
  return { token, courseId: course.body.data.course.id, stamp };
}

async function previewStudents(token, courseId, lines) {
  return request(app)
    .post(`/api/v1/courses/${courseId}/students/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .attach("file", csv(lines), "students.csv");
}

describe("course student CSV import", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  }, 120000);

  afterAll(async () => {
    const courses = await Course.find({ code: { $regex: /^CSI/ } }).select("_id");
    const courseIds = courses.map((row) => row._id);
    await Enrollment.deleteMany({ courseId: { $in: courseIds } });
    await Course.deleteMany({ code: { $regex: /^CSI/ } });
    await Student.deleteMany({ matriculationNumber: { $regex: /^CSI/ } });
    await User.deleteMany({ email: { $regex: `^${USER_PREFIX}` } });
    await disconnectDatabase();
  }, 120000);

  test("downloads a course-specific student template", async () => {
    const { token, courseId } = await seedCourse();
    const response = await request(app)
      .get(`/api/v1/courses/${courseId}/students/template`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("studentName,studentIdentifier,studentEmail");
    expect(response.headers["content-type"]).toMatch(/csv/);
  });

  test("rejects duplicate student IDs and duplicate emails within the file", async () => {
    const { token, courseId, stamp } = await seedCourse();
    const response = await previewStudents(token, courseId, [
      "studentName,studentIdentifier,studentEmail",
      `Alice,CSIA${stamp},alice${stamp.toLowerCase()}@example.com`,
      `Bob,CSIA${stamp},bob${stamp.toLowerCase()}@example.com`,
      `Cara,CSIB${stamp},alice${stamp.toLowerCase()}@example.com`,
    ]);

    expect(response.status).toBe(201);
    expect(response.body.data.summary.validRows).toBe(1);
    expect(response.body.data.summary.invalidRows).toBe(2);
    const messages = response.body.data.invalidRows.map((row) => row.errors.join(" ")).join(" | ");
    expect(messages).toMatch(/Duplicate student ID in this file/);
    expect(messages).toMatch(/Duplicate email in this file/);
  });

  test("rejects IDs and emails that already exist, including previous course enrolments", async () => {
    const { token, courseId, stamp } = await seedCourse();
    const matric = `CSIE${stamp}`;
    const email = `existing${stamp.toLowerCase()}@example.com`;
    const created = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Existing Student", matriculationNumber: matric, email });
    await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: created.body.data.student.id });

    const response = await previewStudents(token, courseId, [
      "studentName,studentIdentifier,studentEmail",
      `Another Student,${matric},${email}`,
    ]);

    expect(response.status).toBe(201);
    expect(response.body.data.summary.validRows).toBe(0);
    expect(response.body.data.invalidRows).toHaveLength(1);
    const message = response.body.data.invalidRows[0].errors.join(" ");
    expect(message).toMatch(/Student ID already exists in the system/);
    expect(message).toMatch(/Email already exists in the system/);
  });

  test("confirms a valid file and enrols the students in the selected course", async () => {
    const { token, courseId, stamp } = await seedCourse();
    const lines = [
      "studentName,studentIdentifier,studentEmail",
      `Dana,CSID${stamp}A,dana${stamp.toLowerCase()}@example.com`,
      `Eli,CSID${stamp}B,eli${stamp.toLowerCase()}@example.com`,
    ];
    const preview = await previewStudents(token, courseId, lines);
    expect(preview.status).toBe(201);
    expect(preview.body.data.summary.validRows).toBe(2);

    const confirm = await request(app)
      .post(`/api/v1/courses/${courseId}/students/import/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ importId: preview.body.data.importId });

    expect(confirm.status).toBe(200);
    expect(confirm.body.data.counts.studentsCreated).toBe(2);
    expect(confirm.body.data.counts.enrolmentsCreated).toBe(2);

    const roster = await request(app)
      .get(`/api/v1/courses/${courseId}/students?limit=50&page=1`)
      .set("Authorization", `Bearer ${token}`);
    const matrics = roster.body.data.items.map((row) => row.student.matriculationNumber);
    expect(matrics).toContain(`CSID${stamp}A`);
    expect(matrics).toContain(`CSID${stamp}B`);

    const repeatPreview = await previewStudents(token, courseId, lines);
    expect(repeatPreview.body.data.summary.validRows).toBe(0);
    expect(repeatPreview.body.data.summary.invalidRows).toBe(2);
  });

  test("imports a large file using bulk writes", async () => {
    const { token, courseId, stamp } = await seedCourse();
    const lines = ["studentName,studentIdentifier,studentEmail"];
    for (let index = 0; index < 500; index += 1) {
      const id = `CSIB${stamp}${String(index).padStart(3, "0")}`;
      lines.push(`Student ${index + 1},${id},student${stamp.toLowerCase()}${index}@example.com`);
    }

    const preview = await previewStudents(token, courseId, lines);
    expect(preview.status).toBe(201);
    expect(preview.body.data.summary.validRows).toBe(500);

    const confirm = await request(app)
      .post(`/api/v1/courses/${courseId}/students/import/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({ importId: preview.body.data.importId });

    expect(confirm.status).toBe(200);
    expect(confirm.body.data.counts.studentsCreated).toBe(500);
    expect(confirm.body.data.counts.enrolmentsCreated).toBe(500);
  });

  test("bulk-enrols multiple existing students in one request", async () => {
    const { token, courseId, stamp } = await seedCourse();
    const studentIds = [];
    for (let index = 0; index < 3; index += 1) {
      const created = await request(app)
        .post("/api/v1/students")
        .set("Authorization", `Bearer ${token}`)
        .send({
          fullName: `Bulk Student ${index + 1}`,
          matriculationNumber: `CSIM${stamp}${index}`,
        });
      studentIds.push(created.body.data.student.id);
    }

    const response = await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments/bulk`)
      .set("Authorization", `Bearer ${token}`)
      .send({ studentIds });

    expect(response.status).toBe(201);
    expect(response.body.data.enrolled).toBe(3);
    expect(response.body.data.alreadyEnrolled).toBe(0);
  });
});
