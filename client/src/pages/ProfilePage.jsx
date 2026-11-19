import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <main className="content">
      <header className="content-header">
        <h1>My Profile</h1>
        <p className="lede">Your lecturer account details. Sign out is available in the sidebar.</p>
      </header>
      <section className="card profile-card">
        <h2>Account</h2>
        <dl className="health">
          <dt>Full name</dt>
          <dd>{user?.fullName}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
        </dl>
      </section>
      <section className="card profile-card">
        <h2>Password &amp; security</h2>
        <p className="lede">Use the password reset flow to change your password. Password hashes are never shown here.</p>
        <Link className="secondary-btn" to="/forgot-password">
          Reset password
        </Link>
      </section>
    </main>
  );
}
