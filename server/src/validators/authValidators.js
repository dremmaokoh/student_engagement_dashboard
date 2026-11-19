import { HttpError } from "../utils/httpError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function validateRegisterInput(body) {
  const fullName = String(body?.fullName || "").trim();
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");

  if (fullName.length < 2 || fullName.length > 100) {
    throw new HttpError(400, "Full name must be between 2 and 100 characters.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, "A valid email address is required.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, "Password must be between 8 and 72 characters.");
  }

  return { fullName, email, password };
}

export function validateForgotPasswordInput(body) {
  const email = normalizeEmail(body?.email);
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, "A valid email address is required.");
  }
  return { email };
}

export function validateResetPasswordInput(body) {
  const token = String(body?.token || "").trim();
  const password = String(body?.password || "");
  if (!token) {
    throw new HttpError(400, "A reset token is required.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, "Password must be between 8 and 72 characters.");
  }
  return { token, password };
}

export function validateLoginInput(body) {
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");

  if (!EMAIL_PATTERN.test(email) || password.length < 1) {
    throw new HttpError(400, "Email and password are required.");
  }

  return { email, password };
}
