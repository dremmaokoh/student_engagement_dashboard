import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ensureDatabaseConnection } from "../middleware/ensureDatabaseConnection.js";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { toPublicUser } from "../utils/publicUser.js";
import {
  isMailConfigured,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "./mailService.js";

const SALT_ROUNDS = 12;
const INVALID_CREDENTIALS = "Invalid email or password.";
const RESET_MESSAGE =
  "If that email is registered, a password reset link has been sent.";
const RESET_TTL_MS = 30 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(rawToken) {
  const origin = env.clientOrigin.replace(/\/$/, "");
  return `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

function requireJwtSecret() {
  if (!env.jwtSecret || env.jwtSecret === "replace-with-a-long-random-string") {
    throw new HttpError(500, "Server authentication is not configured.");
  }
}

export function signAccessToken(user) {
  requireJwtSecret();
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyAccessToken(token) {
  requireJwtSecret();
  return jwt.verify(token, env.jwtSecret);
}

export async function registerLecturer({ fullName, email, password }) {
  await ensureDatabaseConnection();
  if (!env.authRegisterEnabled) {
    throw new HttpError(403, "Registration is disabled for this prototype.");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role: "lecturer",
  });

  sendWelcomeEmail(user.email, user.fullName).catch(() => {});

  return {
    token: signAccessToken(user),
    user: toPublicUser(user),
  };
}

export async function loginLecturer({ email, password }) {
  await ensureDatabaseConnection();
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  return {
    token: signAccessToken(user),
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }
  return toPublicUser(user);
}

async function deliverPasswordResetEmail(to, resetUrl) {
  if (!isMailConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  let timeoutId;
  try {
    return await Promise.race([
      sendPasswordResetEmail(to, resetUrl),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ sent: false, reason: "timeout" }), 20_000);
      }),
    ]);
  } catch {
    return { sent: false, reason: "error" };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function requestPasswordReset(email) {
  await ensureDatabaseConnection();
  const response = { message: RESET_MESSAGE };
  const user = await User.findOne({ email }).select(
    "+passwordResetTokenHash +passwordResetExpires",
  );

  if (!user) {
    return response;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  const resetUrl = buildResetUrl(rawToken);
  const delivery = await deliverPasswordResetEmail(user.email, resetUrl);

  const exposeResetLink = env.nodeEnv !== "production" || !delivery.sent;
  if (exposeResetLink) {
    response.resetUrl = resetUrl;
    if (!delivery.sent) {
      response.hint =
        "We could not send email from this server. Use the reset link below to reset your password (valid for 30 minutes).";
    } else if (env.nodeEnv !== "production") {
      response.hint = "Development only: use the reset link below if you did not receive email.";
    }
  }

  return response;
}

export async function resetPassword({ token, password }) {
  await ensureDatabaseConnection();
  const tokenHash = hashResetToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires +passwordHash");

  if (!user) {
    throw new HttpError(400, "This reset link is invalid or has expired.");
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  await user.save();

  sendPasswordChangedEmail(user.email).catch(() => {});
}
