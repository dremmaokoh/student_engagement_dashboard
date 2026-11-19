import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

const DEBUG_INGEST =
  "http://127.0.0.1:7729/ingest/49b0ec64-57cd-4256-bb67-4237dbfe0263";

function debugLog(hypothesisId, location, message, data) {
  // #region agent log
  fetch(DEBUG_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c0dc5a" },
    body: JSON.stringify({
      sessionId: "c0dc5a",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export function mailTransportMode() {
  if (env.resendApiKey) {
    return "resend";
  }
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    return "smtp";
  }
  return "none";
}

export function isMailConfigured() {
  return mailTransportMode() !== "none";
}

function getTransporter() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
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

function resendFromAddress() {
  const from = env.resendFrom?.trim() || env.mailFrom?.trim();
  if (from) {
    return from;
  }
  return "Student Engagement Dashboard <onboarding@resend.dev>";
}

async function sendViaResend({ to, subject, text, html, replyTo }) {
  const from = resendFromAddress();
  debugLog("D", "mailService.js:sendViaResend", "resend_attempt", {
    hasReplyTo: Boolean(replyTo),
    fromDomain: from.includes("@") ? from.split("@").pop() : "unknown",
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: html || `<pre>${text || ""}</pre>`,
        text: text || undefined,
        reply_to: replyTo || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      debugLog("D", "mailService.js:sendViaResend", "resend_rejected", {
        status: response.status,
        errorName: payload?.name || null,
      });
      return {
        sent: false,
        reason: "resend_error",
        detail: payload?.message || `Resend HTTP ${response.status}`,
        code: payload?.name || String(response.status),
      };
    }
    debugLog("D", "mailService.js:sendViaResend", "resend_ok", {
      idPresent: Boolean(payload?.id),
    });
    return { sent: true, messageId: payload?.id || null, provider: "resend" };
  } catch (error) {
    debugLog("D", "mailService.js:sendViaResend", "resend_exception", {
      code: error?.code || null,
    });
    return { sent: false, reason: "resend_error", code: error?.code || null };
  }
}

async function sendViaSmtp({ to, subject, text, html, replyTo }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { sent: false, reason: "not_configured" };
  }

  debugLog("A", "mailService.js:sendViaSmtp", "smtp_attempt", {
    host: env.smtpHost,
    port: env.smtpPort,
    codeExpected: "ETIMEDOUT_if_cloud_blocked",
  });

  try {
    const info = await mailer.sendMail({
      from: mailFromAddress(),
      to,
      replyTo: replyTo || undefined,
      subject,
      text,
      html,
    });
    debugLog("A", "mailService.js:sendViaSmtp", "smtp_ok", { hasMessageId: Boolean(info?.messageId) });
    return { sent: true, messageId: info?.messageId || null, provider: "smtp" };
  } catch (error) {
    console.error("Mail send failed:", error.code || "unknown", error.message || "no message");
    debugLog("A", "mailService.js:sendViaSmtp", "smtp_failed", {
      code: error?.code || null,
      message: error?.message || null,
    });
    return {
      sent: false,
      reason: "smtp_error",
      code: error.code || null,
    };
  }
}

export async function sendMail(params) {
  const mode = mailTransportMode();
  debugLog("B", "mailService.js:sendMail", "transport_selected", { mode });

  if (mode === "resend") {
    return sendViaResend(params);
  }
  if (mode === "smtp") {
    return sendViaSmtp(params);
  }
  return { sent: false, reason: "not_configured" };
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