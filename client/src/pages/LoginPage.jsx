import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import LoadingState from "../components/common/LoadingState.jsx";
import PasswordField from "../components/design/PasswordField.jsx";
import AuthLayout from "../components/layout/AuthLayout.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

const pageCopy = {
  eyebrow: "Lecturer portal",
  title: "Welcome back!",
  description: "Lecturer access to the Student Engagement Dashboard.",
};

export default function LoginPage() {
  const { login, isAuthenticated, loading, registrationEnabled } = useAuth();
  const location = useLocation();
  const resetNotice = Boolean(location.state?.passwordReset);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <AuthLayout {...pageCopy}>
        <LoadingState loading variant="section" size="lg" delay={80} message="Preparing sign in…" />
      </AuthLayout>
    );
  }

  if (isAuthenticated) {
    const next = location.state?.from || "/";
    return <Navigate to={next} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
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
        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {resetNotice ? <p className="auth-notice" role="status">Password updated. Sign in with your new password.</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <div className="auth-switch">
        <Link to="/forgot-password">Forgot password?</Link>
        {registrationEnabled ? (
          <>
            <span aria-hidden="true">·</span>
            <Link to="/register">Create lecturer profile</Link>
          </>
        ) : (
          <span>Registration is disabled. Use a seeded lecturer account.</span>
        )}
      </div>
    </AuthLayout>
  );
}
