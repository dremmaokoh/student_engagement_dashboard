import { env } from "../config/env.js";
import {
  getCurrentUser,
  loginLecturer,
  registerLecturer,
  requestPasswordReset,
  resetPassword,
} from "../services/authService.js";
import {
  validateForgotPasswordInput,
  validateLoginInput,
  validateRegisterInput,
  validateResetPasswordInput,
} from "../validators/authValidators.js";

export function getRegistrationStatus(_req, res) {
  res.json({
    data: {
      enabled: env.authRegisterEnabled,
    },
  });
}

export async function register(req, res) {
  const input = validateRegisterInput(req.body);
  const result = await registerLecturer(input);
  res.status(201).json({ data: result });
}

export async function login(req, res) {
  const input = validateLoginInput(req.body);
  const result = await loginLecturer(input);
  res.json({ data: result });
}

export async function me(req, res) {
  const user = await getCurrentUser(req.user.id);
  res.json({ data: { user } });
}

export async function forgotPassword(req, res) {
  const { email } = validateForgotPasswordInput(req.body);
  const result = await requestPasswordReset(email);
  res.json({ data: result });
}

export async function resetPasswordHandler(req, res) {
  const input = validateResetPasswordInput(req.body);
  await resetPassword(input);
  res.json({
    data: {
      message: "Password updated. You can now sign in with your new password.",
    },
  });
}
