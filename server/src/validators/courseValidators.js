import { HttpError } from "../utils/httpError.js";

export function validateCourseInput(body, { partial = false } = {}) {
  const result = {};

  if (!partial || body.name !== undefined) {
    const name = String(body?.name || "").trim();
    if (name.length < 2 || name.length > 120) {
      throw new HttpError(400, "Course name must be between 2 and 120 characters.");
    }
    result.name = name;
  }

  if (!partial || body.code !== undefined) {
    const code = String(body?.code || "")
      .trim()
      .toUpperCase();
    if (code.length < 2 || code.length > 32) {
      throw new HttpError(400, "Course code must be between 2 and 32 characters.");
    }
    result.code = code;
  }

  if (!partial || body.description !== undefined) {
    result.description = String(body?.description || "").trim();
    if (result.description.length > 2000) {
      throw new HttpError(400, "Description is too long.");
    }
  }

  if (partial && Object.keys(result).length === 0) {
    throw new HttpError(400, "No valid course fields were provided.");
  }

  return result;
}

export function validateStudentInput(body, { partial = false } = {}) {
  const result = {};

  if (!partial || body.fullName !== undefined) {
    const fullName = String(body?.fullName || "").trim();
    if (fullName.length < 2 || fullName.length > 100) {
      throw new HttpError(400, "Student full name must be between 2 and 100 characters.");
    }
    result.fullName = fullName;
  }

  if (!partial || body.matriculationNumber !== undefined) {
    const matriculationNumber = String(body?.matriculationNumber || "")
      .trim()
      .toUpperCase();
    if (matriculationNumber.length < 2 || matriculationNumber.length > 40) {
      throw new HttpError(400, "Matriculation number must be between 2 and 40 characters.");
    }
    result.matriculationNumber = matriculationNumber;
  }

  if (!partial || body.email !== undefined) {
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    result.email = email || null;
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
      throw new HttpError(400, "Student email is invalid.");
    }
  }

  if (partial && Object.keys(result).length === 0) {
    throw new HttpError(400, "No valid student fields were provided.");
  }

  return result;
}
