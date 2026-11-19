import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

export function isMailConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function getTransporter() {
  if (!isMailConfigured()) {
    return null;
  }
  if (!transporter) {
    const useSmtps = env.smtpPort === 465;
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: useSmtps,
      requireTLS: !useSmtps,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }
  return transporter;
}

function mailFromAddress() {
  const from = env.mailFrom?.trim();
  if (from) {
    return from;
  }
  return env.smtpUser;
}

export async function sendMail({ to, subject, text, html, replyTo }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const info = await mailer.sendMail({
      from: mailFromAddress(),
      to,
      replyTo: replyTo || undefined,
      subject,
      text,
      html,
    });
    return { sent: true, messageId: info?.messageId || null };
  } catch (error) {
    console.error("Mail send failed:", error.code || "unknown", error.message || "no message");
    return {
      sent: false,
      reason: "smtp_error",
      code: error.code || null,
    };
  }
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const subject = "Reset your Student Engagement Dashboard password";
  const text = [
    "A password reset was requested for your lecturer account.",
    `Open this link within 30 minutes: ${resetUrl}`,
    "If you did not request this, you can ignore this email.",
  ].join("\n\n");
  const html = `
    <p>A password reset was requested for your lecturer account.</p>
    <p><a href="${resetUrl}">Reset your password</a> (valid for 30 minutes).</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  return sendMail({ to, subject, text, html });
}

export async function sendPasswordChangedEmail(to) {
  const subject = "Your Student Engagement Dashboard password was changed";
  const text =
    "Your lecturer password was changed successfully. If you did not do this, contact your administrator.";
  const html = `<p>${text}</p>`;
  return sendMail({ to, subject, text, html });
}

export async function sendWelcomeEmail(to, fullName) {
  const subject = "Welcome to the Student Engagement Dashboard";
  const text = `Hello ${fullName}, your lecturer account is ready. You can sign in and manage your courses.`;
  const html = `<p>Hello ${fullName},</p><p>Your lecturer account is ready. You can sign in and manage your courses.</p>`;
  return sendMail({ to, subject, text, html });
}
