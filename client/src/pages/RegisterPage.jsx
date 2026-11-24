import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import LoadingState from "../components/common/LoadingState.jsx";
import PasswordField from "../components/design/PasswordField.jsx";
import AuthLayout from "../components/layout/AuthLayout.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { apiRequest } from "../services/api.js";

const pageCopy = {
  eyebrow: "Join the workspace",
  title: "Create Your Lecturer Profile",
  description: "Set up your lecturer account to monitor student engagement across your courses.",
};

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
      <AuthLayout {...pageCopy}>
        <LoadingState loading variant="section" size="lg" delay={80} message="Preparing registration…" />
      </AuthLayout>
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
    <AuthLayout {...pageCopy}>
      {dbStatus === "disconnected" ? (
        <p className="form-error auth-alert" role="alert">
          The API reports the database is disconnected. Registration will fail until MongoDB Atlas is reachable from
          this machine (check IP allowlist and <code>MONGODB_URI</code> in <code>server/.env</code>).
        </p>
      ) : null}
      {dbStatus === "unreachable" ? (
        <p className="form-error auth-alert" role="alert">
          Cannot reach the API at <code>/api/v1/health</code>. Start the server on port 5000 and keep the Vite client on
          5173.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="auth-field">
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
        </div>
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
          {submitting ? "Creating profile…" : "Create Lecturer Profile"}
        </button>
      </form>
      <p className="auth-switch">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
