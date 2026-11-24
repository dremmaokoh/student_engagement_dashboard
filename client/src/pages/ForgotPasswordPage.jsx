import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/layout/AuthLayout.jsx";
import { apiRequest } from "../services/api.js";

const pageCopy = {
  eyebrow: "Account recovery",
  title: "Forgot password",
  description: "Enter your lecturer email. If it is registered, we will send a reset link.",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [hint, setHint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setResetUrl("");
    setHint("");
    setSubmitting(true);
    try {
      const result = await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMessage(result.data.message);
      if (result.data.hint) {
        setHint(result.data.hint);
      }
      if (result.data.resetUrl) {
        setResetUrl(result.data.resetUrl);
      }
    } catch (err) {
      setError(err.message || "Unable to start a password reset.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout {...pageCopy}>
      <form onSubmit={onSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="auth-notice" role="status">{message}</p> : null}
        {hint ? <p className="auth-description auth-hint">{hint}</p> : null}
        {resetUrl ? (
          <p className="auth-switch">
            <a href={resetUrl}>Open reset link</a>
          </p>
        ) : null}
        <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
