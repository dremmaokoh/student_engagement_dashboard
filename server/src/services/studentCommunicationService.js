import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Student from "../models/Student.js";
import StudentCommunication from "../models/StudentCommunication.js";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { parsePagination, paginated } from "../utils/pagination.js";
import { toPublicCourse } from "../utils/toPublic.js";
import { env } from "../config/env.js";
import { describeMailFailure } from "./mailDeliveryErrors.js";
import { sendMail } from "./mailService.js";

async function assertLecturerStudentAccess(lecturerId, studentId) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new HttpError(404, "Student not found.");
  }
  const student = await Student.findById(studentId);
  if (!student) {
    throw new HttpError(404, "Student not found.");
  }
  const courses = await Course.find({ lecturerId }).select("_id");
  const courseIds = courses.map((course) => course._id);
  const enrollment = await Enrollment.findOne({ studentId, courseId: { $in: courseIds }, status: "active" });
  if (!enrollment) {
    throw new HttpError(404, "Student not found.");
  }
  return student;
}

async function resolveCourseContext(lecturerId, studentId, courseId) {
  if (!courseId) {
    return null;
  }
  if (!mongoose.isValidObjectId(courseId)) {
    throw new HttpError(400, "Invalid course context.");
  }
  const course = await Course.findOne({ _id: courseId, lecturerId });
  if (!course) {
    throw new HttpError(404, "Course was not found.");
  }
  const enrolled = await Enrollment.findOne({ courseId: course._id, studentId, status: "active" });
  if (!enrolled) {
    throw new HttpError(400, "This student is not enrolled in the selected course.");
  }
  return course;
}

function toPublicCommunication(row, courseMap) {
  const course = row.courseId ? courseMap.get(String(row.courseId)) : null;
  return {
    id: String(row._id),
    studentId: String(row.studentId),
    courseId: row.courseId ? String(row.courseId) : null,
    course: course ? toPublicCourse(course) : null,
    fromEmail: row.fromEmail,
    replyToEmail: row.replyToEmail,
    toEmail: row.toEmail,
    subject: row.subject,
    bodyText: row.bodyText,
    status: row.status,
    providerMessageId: row.providerMessageId || null,
    errorMessage: row.errorMessage || null,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
  };
}

export async function listStudentCommunications(studentId, lecturerId, query) {
  await assertLecturerStudentAccess(lecturerId, studentId);
  const pagination = parsePagination(query);
  const filter = { studentId, lecturerId };
  const [rows, total] = await Promise.all([
    StudentCommunication.find(filter)
      .sort({ sentAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    StudentCommunication.countDocuments(filter),
  ]);

  const courseIds = [...new Set(rows.map((row) => String(row.courseId || "")).filter(Boolean))];
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds } }).select("code name status lecturerId")
    : [];
  const courseMap = new Map(courses.map((course) => [String(course._id), course]));

  const items = rows.map((row) => toPublicCommunication(row, courseMap));
  return paginated(items, total, pagination.page, pagination.limit);
}

export async function sendStudentMessage(studentId, lecturerId, input) {
  const student = await assertLecturerStudentAccess(lecturerId, studentId);
  const lecturer = await User.findById(lecturerId).select("email fullName");
  if (!lecturer?.email) {
    throw new HttpError(400, "Your account does not have an email address on file.");
  }
  if (!student.email) {
    throw new HttpError(400, "This student does not have a registered email address.");
  }

  const course = await resolveCourseContext(lecturerId, student._id, input.courseId);
  const replyToEmail = String(lecturer.email).trim().toLowerCase();
  const toEmail = String(student.email).trim().toLowerCase();
  const html = input.message.replace(/\n/g, "<br />\n");
  const courseLine = course ? `\n\nCourse: ${course.code} – ${course.name}` : "";
  const textBody = `${input.message}${courseLine}`;

  let status = "failed";
  let providerMessageId = null;
  let errorMessage = null;

  try {
    const result = await sendMail({
      to: toEmail,
      subject: input.subject,
      text: textBody,
      html: `<p>${html}</p>${course ? `<p><strong>Course:</strong> ${course.code} – ${course.name}</p>` : ""}`,
      replyTo: replyToEmail,
    });
    if (result.sent) {
      status = "sent";
      providerMessageId = result.messageId || null;
    } else if (result.reason === "not_configured") {
      status = "not_configured";
      errorMessage = describeMailFailure(result);
    } else {
      status = "failed";
      errorMessage = describeMailFailure(result) || "The message could not be sent.";
    }
  } catch (error) {
    status = "failed";
    errorMessage = error?.message || "The message could not be sent.";
  }

  const record = await StudentCommunication.create({
    lecturerId,
    studentId: student._id,
    courseId: course?._id || null,
    fromEmail: String(env.mailFrom || replyToEmail).trim(),
    replyToEmail,
    toEmail,
    subject: input.subject,
    bodyText: input.message,
    status,
    providerMessageId,
    errorMessage,
    sentAt: new Date(),
  });

  const courseMap = course ? new Map([[String(course._id), course]]) : new Map();

  if (status === "sent") {
    return {
      ok: true,
      communication: toPublicCommunication(record, courseMap),
    };
  }

  if (status === "not_configured") {
    throw new HttpError(
      503,
      "Email delivery is not configured. The message was saved but not sent.",
      {
        communication: toPublicCommunication(record, courseMap),
      },
    );
  }

  throw new HttpError(502, errorMessage || "The message could not be sent.", {
    communication: toPublicCommunication(record, courseMap),
  });
}