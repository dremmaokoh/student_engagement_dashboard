import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ContentSkeleton, {
  SkeletonBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "../components/common/ContentSkeleton.jsx";
import { skeletonColumns } from "../lib/skeletonColumns.js";
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
    setCourse(null);
    setConfig(null);
    setGlobalWeights(null);
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
        <ContentSkeleton loading label="Fetching course configuration…">
          <SkeletonPageHeader />
          <section className="card" aria-hidden="true">
            <div className="settings-config-readonly">
              <section className="settings-config-block">
                <SkeletonBar width="38%" height={16} />
                <SkeletonBar width="66%" />
                <div className="settings-weight-list">
                  {Array.from({ length: 3 }, (_, index) => (
                    <SkeletonBar key={index} width="78%" />
                  ))}
                </div>
              </section>
              <section className="settings-config-block">
                <SkeletonBar width="34%" height={16} />
                <SkeletonBar width="58%" />
                <SkeletonTable
                  columns={skeletonColumns("bands")}
                  rows={5}
                  tableClassName="settings-compact-table"
                />
              </section>
              <section className="settings-config-block">
                <SkeletonBar width="30%" height={16} />
                <SkeletonBar width="72%" />
              </section>
              <section className="settings-config-block">
                <SkeletonBar width="32%" height={16} />
                <SkeletonBar width="70%" />
              </section>
              <section className="settings-config-block">
                <SkeletonBar width="42%" height={16} />
                <SkeletonTable
                  columns={skeletonColumns("boundaries")}
                  rows={3}
                  tableClassName="settings-compact-table"
                />
                <SkeletonBar width="64%" />
              </section>
            </div>
          </section>
        </ContentSkeleton>
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