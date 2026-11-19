import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import IndicatorGlyph from "../components/dashboard/IndicatorGlyph.jsx";
import ScoreBar from "../components/dashboard/ScoreBar.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import IndicatorStatusBadge from "../components/design/IndicatorStatusBadge.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { formatScore, indicatorLabel, weightPercent } from "../lib/classifications.js";
import {
  applicableIndicatorKeys,
  contributionFormula,
  formatContribution,
  loginBandExplanation,
  loginEvidence,
  overallContributionFormula,
  ratioDetails,
  weightedScore,
} from "../lib/resultPresentation.js";
import { apiRequest } from "../services/api.js";

const INDICATOR_KEYS = ["lastActivity", "materialAccess", "assignmentSubmission"];

function dateLabel(value) {
  if (!value) {
    return "Missing";
  }
  return String(value).slice(0, 10);
}

function weightLabel(result, indicatorKey) {
  const weight = result?.configuredWeights?.[indicatorKey];
  return weight === null || weight === undefined ? "—" : weightPercent(weight);
}

function InfoRow({ children }) {
  return (
    <p className="indicator-info-row">
      <span className="indicator-info-icon" aria-hidden="true">
        ⓘ
      </span>
      <span>{children}</span>
    </p>
  );
}

function IndicatorEvidence({ result, indicatorKey, indicator }) {
  if (indicatorKey === "lastActivity") {
    const evidence = loginEvidence(result);
    const range = loginBandExplanation(result);
    const formula = contributionFormula(result, indicatorKey);
    if (evidence || range || formula) {
      return (
        <div className="indicator-evidence">
          {evidence ? <InfoRow>{evidence}</InfoRow> : null}
          {range ? <InfoRow>{range}</InfoRow> : null}
          {formula ? <p className="indicator-calculation">{formula}</p> : null}
        </div>
      );
    }
  }

  if (indicatorKey === "materialAccess" || indicatorKey === "assignmentSubmission") {
    const details =
      indicatorKey === "materialAccess"
        ? ratioDetails(
            result,
            "materialAccess",
            "materialsAccessed",
            "materialsAvailable",
            "materials",
            "accessed",
          )
        : ratioDetails(
            result,
            "assignmentSubmission",
            "assignmentsSubmitted",
            "assignmentsDue",
            "assignments",
            "submitted",
          );
    const formula = contributionFormula(result, indicatorKey);
    if (details || formula) {
      return (
        <div className="indicator-evidence">
          {details ? <InfoRow>{details.evidence}</InfoRow> : null}
          {details?.calculation ? <p className="indicator-calculation">{details.calculation}</p> : null}
          {formula ? <p className="indicator-calculation">{formula}</p> : null}
        </div>
      );
    }
  }

  return indicator?.reason ? <InfoRow>{indicator.reason}</InfoRow> : null;
}

function CalculationExplanation({ result }) {
  const includedKeys = applicableIndicatorKeys(result);
  const overallFormula = overallContributionFormula(result);
  return (
    <div className="result-calculation-body">
      <h4 className="result-calculation-title">Calculation method</h4>
      <p className="result-calculation-desc">
        Only indicators marked Calculated are included. Their saved weights are normalised across the applicable
        indicators for this run; the weighted score shown uses that normalised share. The overall score is the sum of
        those weighted scores.
      </p>
      <p className="result-calculation-desc">
        Not Applicable indicators are excluded. Insufficient Data prevents a final score from being calculated.
      </p>
      {includedKeys.length ? (
        <div className="result-formula-block">
          <ul className="result-formula-list">
            {includedKeys.map((key) => (
              <li key={key}>
                <span>{indicatorLabel(key)}</span>
                <span className="result-formula-equation">{contributionFormula(result, key)}</span>
              </li>
            ))}
          </ul>
          {overallFormula ? <p className="result-formula-total">{overallFormula}</p> : null}
        </div>
      ) : null}
      {result.explanation?.overall ? <p className="result-calculation-note">{result.explanation.overall}</p> : null}
    </div>
  );
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
  const overallValue = result.overallScore ?? result.displayScore;

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

      <section className="card result-overall-card" aria-labelledby="overall-result-heading">
        <div className="result-overall-layout">
          <div className="result-overall-summary">
            <h2 id="overall-result-heading" className="result-section-title">
              Overall Result
            </h2>
            <p className="result-classification-row">
              <ClassificationBadge classification={result.classification} />
            </p>
            <div className="result-overall-score">
              <span className="result-score-value">
                {result.displayScore === null || result.displayScore === undefined
                  ? "—"
                  : formatScore(result.displayScore)}
              </span>
              <span className="result-score-caption">Overall Score</span>
            </div>
            {canShowOverallBar ? (
              <ScoreBar score={result.displayScore} label="Overall score" tone={result.classification} />
            ) : null}
            {!canShowOverallBar ? (
              <p className="result-inline-note">No overall score was calculated for this saved result.</p>
            ) : null}
            {result.noClassifiableActivity ? (
              <p className="result-inline-note">No classifiable activity: all indicators are Not Applicable.</p>
            ) : null}
            <p className="result-config-note">
              Configuration v{result.configurationVersion} · Saved with this result; later setting changes do not alter
              it.
            </p>
          </div>

          <div className="result-breakdown-table-scroll">
            <table className="result-breakdown-table">
              <caption>Indicator Breakdown</caption>
              <thead>
                <tr>
                  <th scope="col">Indicator</th>
                  <th scope="col">Calculated Score</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Weighted Score</th>
                </tr>
              </thead>
              <tbody>
                {INDICATOR_KEYS.map((key) => {
                  const indicator = indicators[key];
                  if (!indicator) {
                    return null;
                  }
                  return (
                    <tr key={key}>
                      <th scope="row">
                        <span className={`result-table-indicator result-accent-${key}`}>
                          <span className="result-table-dot" aria-hidden="true" />
                          {indicatorLabel(key)}
                        </span>
                      </th>
                      <td>{formatScore(indicator.score)}</td>
                      <td>{weightLabel(result, key)}</td>
                      <td>{formatContribution(weightedScore(result, key))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan="3">
                    Overall Score (Σ Weighted Scores)
                  </th>
                  <td>{formatContribution(overallValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <details className="result-calculation">
          <summary>How was this score calculated?</summary>
          <CalculationExplanation result={result} />
        </details>
      </section>

      <section className="result-indicator-section" aria-labelledby="indicator-breakdown-heading">
        <div className="result-section-heading">
          <h2 id="indicator-breakdown-heading">Indicator Breakdown</h2>
          <p className="panel-desc">Scores, weights, and evidence saved with this result.</p>
        </div>
        <div className="status-grid result-indicator-grid">
          {INDICATOR_KEYS.map((key) => {
            const indicator = indicators[key];
            if (!indicator) {
              return null;
            }
            const contribution = weightedScore(result, key);
            const hasScore = indicator.score !== null && indicator.score !== undefined;
            return (
              <article key={key} className={`indicator-card indicator-${key} result-accent-${key}`}>
                <div className="result-card-header">
                  <h3>
                    <IndicatorGlyph indicatorKey={key} /> {indicatorLabel(key)}
                  </h3>
                  <IndicatorStatusBadge status={indicator.status} indicatorKey={key} />
                </div>

                <div className="result-metric-primary">
                  <span className="result-metric-value">{formatContribution(contribution)}</span>
                  <span className="result-metric-label">Weighted Score</span>
                </div>

                <div className="result-metric-secondary">
                  <span className="result-metric-label">Calculated Score</span>
                  <span className="result-metric-value">
                    {hasScore ? formatContribution(indicator.score) : "—"}
                    {hasScore ? <span className="result-metric-unit">/100</span> : null}
                  </span>
                </div>

                <ScoreBar score={indicator.score} label={indicatorLabel(key)} tone={key} />

                <dl className="indicator-weight-row">
                  <div>
                    <dt>Weight</dt>
                    <dd>{weightLabel(result, key)}</dd>
                  </div>
                </dl>

                <IndicatorEvidence result={result} indicatorKey={key} indicator={indicator} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="card result-snapshot-card">
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
      </section>
    </main>
  );
}
