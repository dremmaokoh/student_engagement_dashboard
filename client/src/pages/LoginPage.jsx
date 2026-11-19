import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import PasswordField from "../components/design/PasswordField.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

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
      <main className="auth-page">
        <section className="card auth-card">
          <p className="lede">Loading…</p>
        </section>
      </main>
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
    <main className="auth-page">
      <section className="card auth-card">
        <div className="brand-bar" aria-hidden="true" />
        <h1>Sign in</h1>
        <p className="lede">Lecturer access to the Student Engagement Dashboard.</p>
        <form onSubmit={onSubmit} className="auth-form">
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
          <PasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {resetNotice ? <p role="status">Password updated. Sign in with your new password.</p> : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        {registrationEnabled ? (
          <p className="auth-switch">
            Need an account? <Link to="/register">Create a lecturer profile</Link>
          </p>
        ) : (
          <p className="auth-switch">Registration is disabled. Use a seeded lecturer account.</p>
        )}
      </section>
    </main>
  );
}
