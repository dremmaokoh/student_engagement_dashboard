import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ContentSkeleton from "../components/common/ContentSkeleton.jsx";
import { skeletonColumns } from "../lib/skeletonColumns.js";
import DesignLegend from "../components/design/DesignLegend.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { apiRequest } from "../services/api.js";

export default function OverviewPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState({ status: "unknown", db: "unknown" });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setCourses([]);
    Promise.all([apiRequest("/api/v1/health"), apiRequest("/api/v1/courses?limit=20")])
      .then(([status, courseResult]) => {
        if (cancelled) {
          return;
        }
        setHealth({ status: status.status, db: status.db });
        setCourses(courseResult.data.items);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setHealth({ status: "unreachable", db: "unknown" });
          setLoading(false);
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
        {!loading && error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <ContentSkeleton
          loading={loading}
          variant="table"
          columns={skeletonColumns("legacyCourses")}
          rows={3}
          label="Fetching course information…"
        />
        {!loading && courses.length === 0 ? (
          <p className="lede">
            No courses yet. <Link to="/courses">Create a course</Link>.
          </p>
        ) : null}
        {!loading && courses.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Code</th>
                <th>Name</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course, index) => (
                <tr key={course.id}>
                  <td className="col-serial">{index + 1}</td>
                  <td>{course.code}</td>
                  <td>{course.name}</td>
                  <td>
                    <Link to={`/courses/${course.id}`}>Course overview</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
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
            {loading ? (
              <span className="badge">—</span>
            ) : (
              <span className={health.status === "ok" ? "badge badge-session-ok" : "badge badge-session-degraded"}>
                {health.status}
              </span>
            )}
          </dd>
          <dt>Database</dt>
          <dd>{loading ? "—" : health.db}</dd>
        </dl>
      </section>
    </main>
  );
}
