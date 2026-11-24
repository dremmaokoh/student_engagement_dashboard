import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoadingState from "../components/common/LoadingState.jsx";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import ConfigurationReadOnlyPanel from "../components/settings/ConfigurationReadOnlyPanel.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { apiRequest } from "../services/api.js";

export default function CourseConfigurationViewPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [config, setConfig] = useState(null);
  const [globalWeights, setGlobalWeights] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [courseResult, configResult, weightsResult] = await Promise.all([
        apiRequest(`/api/v1/courses/${courseId}`),
        apiRequest(`/api/v1/courses/${courseId}/classification-config`),
        apiRequest("/api/v1/settings/indicator-weights"),
      ]);
      setCourse(courseResult.data.course);
      setConfig(configResult.data.config);
      setGlobalWeights(weightsResult.data.weights);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [courseId]);

  if (loading) {
    return (
      <main className="content">
        <LoadingState loading variant="page" size="lg" message="Fetching course configuration…" />
      </main>
    );
  }

  return (
    <main className="content">
      <header className="content-header page-context-header">
        <BackLink fallbackTo={`/courses/${courseId}/overview`} fallbackLabel="Back to course overview" />
        <Breadcrumbs
          items={[
            { label: "Overview", to: "/overview" },
            { label: "Courses", to: "/courses" },
            { label: course?.code || "Course", to: `/courses/${courseId}/overview` },
            { label: "Configuration" },
          ]}
        />
        <h1>Current classification configuration</h1>
        <p className="lede">
          Read-only view for {course?.code} · {course?.name}. Edit in Settings to change rules.
        </p>
        <div className="table-actions">
          <Link
            className="primary-btn"
            to={`/settings/classification/${courseId}`}
            state={{ from: `/courses/${courseId}/configuration`, fromLabel: "Back to configuration" }}
          >
            Edit configuration
          </Link>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>
      <CourseTabs courseId={courseId} />

      <section className="card">
        <ConfigurationReadOnlyPanel config={config} globalWeights={globalWeights} />
      </section>
    </main>
  );
}