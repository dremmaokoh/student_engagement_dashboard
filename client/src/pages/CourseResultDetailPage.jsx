import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import IndicatorGlyph from "../components/dashboard/IndicatorGlyph.jsx";
import ScoreBar from "../components/dashboard/ScoreBar.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import IndicatorStatusBadge from "../components/design/IndicatorStatusBadge.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import {
  formatScore,
  indicatorLabel,
  weightPercent,
} from "../lib/classifications.js";
import { apiRequest } from "../services/api.js";

function dateLabel(value) {
  if (!value) {
    return "Missing";
  }
  return String(value).slice(0, 10);
}

export default function CourseResultDetailPage() {
  const { courseId, resultId } = useParams();
  const [course, setCourse] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [courseResult, detail] = await Promise.all([
          apiRequest(`/api/v1/courses/${courseId}`),
          apiRequest(`/api/v1/courses/${courseId}/classification-results/${resultId}`),
        ]);
        setCourse(courseResult.data.course);
        setResult(detail.data.result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, resultId]);

  if (loading) {
    return (
      <main className="content">
        <p className="lede">Loading evidence…</p>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="content">
        <p className="form-error">{error || "Result not found."}</p>
        <BackLink fallbackTo={`/courses/${courseId}/results`} fallbackLabel="Back to Results & History" />
      </main>
    );
  }

  const activity = result.activitySnapshot;
  const indicators = result.indicators || {};
  const canShowOverallBar = result.classification !== "INSUFFICIENT_DATA" && result.displayScore != null;

  return (
    <main className="content">
      <header className="content-header page-context-header">
        <BackLink
          fallbackTo={`/courses/${courseId}/results`}
          fallbackLabel="Back to Results & History"
        />
        <Breadcrumbs
          items={[
            { label: "Overview", to: "/overview" },
            { label: "Courses", to: "/courses" },
            { label: course?.code || "Course", to: `/courses/${courseId}/overview` },
            { label: "Results & History", to: `/courses/${courseId}/results` },
            { label: result.student?.fullName || "Student" },
          ]}
        />
        <h1>
          {result.student?.fullName} · {result.student?.matriculationNumber}
        </h1>
        <p className="lede">
          {course?.code} · {dateLabel(result.monitoringPeriodStart)} to {dateLabel(result.monitoringPeriodEnd)}
        </p>
      </header>
      <CourseTabs courseId={courseId} />

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card">
        <h2>Overall result</h2>
        <p className="score-line">
          <ClassificationBadge classification={result.classification} />
          <span className="score-numeric">{formatScore(result.displayScore)}</span>
        </p>
        {canShowOverallBar ? (
          <ScoreBar score={result.displayScore} label="Overall score" tone={result.classification} />
        ) : null}
        {!canShowOverallBar ? (
          <p className="lede">No overall score bar is shown because this result is not a calculated classification.</p>
        ) : null}
        <p className="lede">{result.explanation?.overall}</p>
        <p className="lede">{result.explanation?.formula}</p>
        {result.noClassifiableActivity ? (
          <p className="lede">No classifiable activity: all indicators are Not Applicable.</p>
        ) : null}
        <p className="lede">
          Configuration version used: v{result.configurationVersion}. Historical results keep this snapshot if settings
          change later.
        </p>
      </section>

      <section className="status-grid">
        {Object.entries(indicators).map(([key, indicator]) => (
          <article key={key} className={`indicator-card indicator-${key}`}>
            <h3>
              <IndicatorGlyph indicatorKey={key} /> {indicatorLabel(key)}
            </h3>
            <p className="score-line">
              <IndicatorStatusBadge status={indicator.status} indicatorKey={key} />
              {indicator.status === "CALCULATED" ? (
                <span className="score-numeric">{formatScore(indicator.score)}</span>
              ) : null}
            </p>
            {indicator.status === "CALCULATED" ? (
              <ScoreBar score={indicator.score} label={indicatorLabel(key)} tone={key} />
            ) : null}
            <p className="lede">{indicator.reason}</p>
            <p className="lede">
              Configured weight {weightPercent(result.configuredWeights?.[key])}; effective{" "}
              {weightPercent(result.effectiveWeights?.[key])}
            </p>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Supporting activity data</h2>
        {activity ? (
          <dl className="health">
            <dt>{indicatorLabel("lastActivity")}</dt>
            <dd>{dateLabel(activity.lastActivityAt)}</dd>
            <dt>Materials accessed / available</dt>
            <dd>
              {activity.materialsAccessed ?? "Missing"} / {activity.materialsAvailable ?? "Missing"}
            </dd>
            <dt>Assignments submitted / due</dt>
            <dd>
              {activity.assignmentsSubmitted ?? "Missing"} / {activity.assignmentsDue ?? "Missing"}
            </dd>
          </dl>
        ) : (
          <p className="lede">
            No imported activity record exists for this student and period. Missing values are not treated as zero.
          </p>
        )}
        <p className="lede">
          Eligible materials and assignments come from the nine-column activity import aggregates for the monitoring
          period.
        </p>
      </section>
    </main>
  );
}
