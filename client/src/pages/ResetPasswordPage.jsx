import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PasswordField from "../components/design/PasswordField.jsx";
import AuthLayout from "../components/layout/AuthLayout.jsx";
import { apiRequest } from "../services/api.js";

const pageCopy = {
  eyebrow: "Account recovery",
  title: "Set a new password",
  description: "Choose a password of at least 8 characters.",
};

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.message || "Unable to reset the password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout {...pageCopy}>
      <form onSubmit={onSubmit} className="auth-form">
        <PasswordField
          id="password"
          name="password"
          label="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
        />
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
