import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PasswordField from "../components/design/PasswordField.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { apiRequest } from "../services/api.js";

export default function RegisterPage() {
  const { register, isAuthenticated, loading, registrationEnabled } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dbStatus, setDbStatus] = useState("checking");

  useEffect(() => {
    apiRequest("/api/v1/health")
      .then((payload) => setDbStatus(payload.db || "unknown"))
      .catch(() => setDbStatus("unreachable"));
  }, []);

  if (loading) {
    return (
      <main className="auth-page">
        <section className="card auth-card">
          <p className="lede">Loading…</p>
        </section>
      </main>
    );
  }

  if (!registrationEnabled) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await register(fullName, email, password);
    } catch (err) {
      setError(err.message || "Unable to create an account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <div className="brand-bar" aria-hidden="true" />
        <h1>Create lecturer account</h1>
        <p className="lede">Prototype registration is enabled for this release.</p>
        {dbStatus === "disconnected" ? (
          <p className="form-error" role="alert">
            The API reports the database is disconnected. Registration will fail until MongoDB Atlas is reachable from
            this machine (check IP allowlist and <code>MONGODB_URI</code> in <code>server/.env</code>).
          </p>
        ) : null}
        {dbStatus === "unreachable" ? (
          <p className="form-error" role="alert">
            Cannot reach the API at <code>/api/v1/health</code>. Start the server on port 5000 and keep the Vite client on
            5173.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="auth-form">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            minLength={2}
          />
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
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
