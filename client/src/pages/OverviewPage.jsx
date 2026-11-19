import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DesignLegend from "../components/design/DesignLegend.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { apiRequest } from "../services/api.js";

export default function OverviewPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState({ status: "loading", db: "unknown" });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiRequest("/api/v1/health"), apiRequest("/api/v1/courses?limit=20")])
      .then(([status, courseResult]) => {
        if (cancelled) {
          return;
        }
        setHealth({ status: status.status, db: status.db });
        setCourses(courseResult.data.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setHealth({ status: "unreachable", db: "unknown" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="content">
      <header className="content-header">
        <h1>Overview</h1>
        <p className="lede">
          Welcome, {user?.fullName}. Open a course to import activity, configure scoring, and identify students who may
          require follow-up.
        </p>
      </header>

      <section className="card table-card">
        <h2>Your courses</h2>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {courses.length === 0 ? (
          <p className="lede">
            No courses yet. <Link to="/courses">Create a course</Link>.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>{course.code}</td>
                  <td>{course.name}</td>
                  <td>
                    <Link to={`/courses/${course.id}`}>Course overview</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <DesignLegend />

      <section className="card">
        <h2>Session</h2>
        <dl className="health">
          <dt>Signed in as</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
          <dt>API status</dt>
          <dd>
            <span className={health.status === "ok" ? "badge badge-session-ok" : "badge badge-session-degraded"}>
              {health.status}
            </span>
          </dd>
          <dt>Database</dt>
          <dd>{health.db}</dd>
        </dl>
      </section>
    </main>
  );
}
