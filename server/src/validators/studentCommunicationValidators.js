import { HttpError } from "../utils/httpError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSendStudentMessageInput(body) {
  const subject = String(body?.subject || "").trim();
  const message = String(body?.message ?? body?.bodyText ?? "").trim();
  const courseId = body?.courseId ? String(body.courseId).trim() : null;

  if (!subject) {
    throw new HttpError(400, "Subject is required.");
  }
  if (subject.length > 200) {
    throw new HttpError(400, "Subject must be 200 characters or fewer.");
  }
  if (!message) {
    throw new HttpError(400, "Message is required.");
  }
  if (message.length > 20000) {
    throw new HttpError(400, "Message must be 20,000 characters or fewer.");
  }

  return { subject, message, courseId: courseId || null };
}

export function normalizeStudentEmail(raw) {
  const email = String(raw || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return "";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}

export const STUDENT_EMAIL_PATTERN = EMAIL_PATTERN;