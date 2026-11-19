/** User-facing text for failed sends (never expose raw provider codes). */
export function describeMailFailure(result) {
  if (!result || result.sent) {
    return null;
  }
  if (result.reason === "not_configured") {
    return "Email delivery is not configured on this server.";
  }
  if (result.reason === "resend_error") {
    return result.detail || "The email provider rejected this message.";
  }
  if (result.reason === "timeout") {
    return "The mail server did not respond in time.";
  }
  if (result.reason === "smtp_error") {
    if (result.code === "ETIMEDOUT" || result.code === "ESOCKET") {
      return "Could not reach the SMTP server (common on cloud hosts). Use RESEND_API_KEY for reliable delivery.";
    }
    if (result.code === "EAUTH") {
      return "SMTP login failed. Check SMTP_USER and SMTP_PASS (use a Gmail app password).";
    }
    return "The message could not be sent via SMTP.";
  }
  return "The message could not be sent.";
}