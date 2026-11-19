import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { formatRunTitle } from "../lib/classificationRuns.js";
import { courseOverviewPath, readCoursePeriod } from "../lib/coursePeriod.js";
import { apiRequest, downloadAuthenticated } from "../services/api.js";

function ymd(value) {
  if (!value) {
    return "";
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return text.slice(0, 10);
}

function runPeriod(run) {
  if (!run?.monitoringPeriodStart || !run?.monitoringPeriodEnd) {
    return null;
  }
  return {
    periodStart: ymd(run.monitoringPeriodStart),
    periodEnd: ymd(run.monitoringPeriodEnd),
  };
}

export default function CourseResultsPage() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedPeriod = readCoursePeriod(searchParams);
  const [course, setCourse] = useState(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function syncUrlToSelection(period, runId) {
    if (!runId || !period?.periodStart || !period?.periodEnd) {
      return;
    }
    const currentRun = searchParams.get("runId");
    const currentStart = searchParams.get("periodStart");
    const currentEnd = searchParams.get("periodEnd");
    if (
      currentRun === runId &&
      currentStart === period.periodStart &&
      currentEnd === period.periodEnd
    ) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("periodStart", period.periodStart);
    nextParams.set("periodEnd", period.periodEnd);
    nextParams.set("runId", runId);
    setSearchParams(nextParams, { replace: true });
  }

  async function loadRunResults(runId, runRow) {
    const dashPeriod = runPeriod(runRow);
    if (!dashPeriod) {
      setResults(null);
      return;
    }
    const dashParams = new URLSearchParams({
      periodStart: dashPeriod.periodStart,
      periodEnd: dashPeriod.periodEnd,
      runId,
      limit: "50",
    });
    const dash = await apiRequest(`/api/v1/courses/${courseId}/dashboard?${dashParams.toString()}`);
    setResults(dash.data);
    setPeriodStart(dashPeriod.periodStart);
    setPeriodEnd(dashPeriod.periodEnd);
  }

  async function loadHistory(preferredRunId) {
    setLoading(true);
    setError("");
    try {
      const courseResult = await apiRequest(`/api/v1/courses/${courseId}`);
      setCourse(courseResult.data.course);

      const history = await apiRequest(`/api/v1/courses/${courseId}/classification-runs?scope=all`);
      const items = history.data.items || [];
      setRuns(items);

      const chosenRunId =
        preferredRunId && items.some((row) => row.runId === preferredRunId)
          ? preferredRunId
          : items[0]?.runId || "";

      setSelectedRun(chosenRunId);
      const chosenRunRow = items.find((row) => row.runId === chosenRunId);

      if (chosenRunId && chosenRunRow) {
        await loadRunResults(chosenRunId, chosenRunRow);
        syncUrlToSelection(runPeriod(chosenRunRow), chosenRunId);
      } else {
        setResults(null);
        setPeriodStart("");
        setPeriodEnd("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const runFromUrl = searchParams.get("runId") || undefined;
    loadHistory(runFromUrl);
  }, [courseId, searchParams.get("runId")]);

  async function openRun(run) {
    const runId = run.runId;
    setSelectedRun(runId);
    setError("");
    try {
      await loadRunResults(runId, run);
      syncUrlToSelection(runPeriod(run), runId);
    } catch (err) {
      setError(err.message);
    }
  }

  const exportPeriod = selectedRun ? runPeriod(runs.find((row) => row.runId === selectedRun)) : null;
  const selectedRunRow = runs.find((row) => row.runId === selectedRun);
  const selectedRunTitle = selectedRunRow ? formatRunTitle(course?.code, selectedRunRow.runName) : null;

  return (
    <main className="content">
      <header className="content-header page-context-header">
        <BackLink fallbackTo="/courses" fallbackLabel="Back to Courses" />
        <Breadcrumbs
          items={[
            { label: "Overview", to: "/overview" },
            { label: "Courses", to: "/courses" },
            { label: course?.code || "Course", to: courseOverviewPath(courseId, appliedPeriod) },
            { label: "Results & History" },
          ]}
        />
        <h1>Results &amp; History</h1>
        <p className="lede">
          {course?.code
            ? `Every generate creates an immutable run for ${course.code}. The table lists all runs for this course. Open a run to view its students and the monitoring period used when it was generated.`
            : "All classification runs for this course. Open a run to view its results and monitoring period."}
        </p>
      </header>
      <CourseTabs courseId={courseId} />

      <section className="card">
        <h2>Selected run</h2>
        {selectedRunTitle ? (
          <p className="course-results-run-title">
            <strong>{selectedRunTitle}</strong>
          </p>
        ) : null}
        <dl className="activity-import-used-dl course-monitoring-import-dl course-monitoring-import-dl-compact">
          <div>
            <dt>Monitoring period (for open run)</dt>
            <dd>
              {periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : "Select a run from the table below."}
            </dd>
          </div>
          <div>
            <dt>Run ID</dt>
            <dd>{selectedRun || "—"}</dd>
          </div>
        </dl>
        <div className="course-monitoring-toolbar-secondary" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="secondary-btn"
            disabled={!selectedRun || !exportPeriod}
            onClick={() => {
              if (!exportPeriod || !selectedRun) {
                return;
              }
              const params = new URLSearchParams({
                periodStart: exportPeriod.periodStart,
                periodEnd: exportPeriod.periodEnd,
                runId: selectedRun,
              });
              downloadAuthenticated(
                `/api/v1/courses/${courseId}/classification-results/export?${params.toString()}`,
                `${course?.code || "course"}-classification-results.csv`,
              ).catch((err) => setError(err.message));
            }}
          >
            Export results CSV
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="card table-card">
        <h2>Run history</h2>
        <p className="panel-desc">All classification runs for this course, newest first.</p>
        {loading ? <p className="lede">Loading history…</p> : null}
        {!loading && !error && runs.length === 0 ? (
          <p className="lede">No classification runs yet. Generate classifications from Monitoring.</p>
        ) : null}
        {runs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Run name</th>
                <th>Generated</th>
                <th>Monitoring period</th>
                <th>Config</th>
                <th>Students</th>
                <th>Active</th>
                <th>Attention</th>
                <th>Inactive</th>
                <th>Insufficient</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.runId} className={run.runId === selectedRun ? "row-selected" : undefined}>
                  <td className="course-results-run-name-cell">
                    <strong>{formatRunTitle(course?.code, run.runName)}</strong>
                  </td>
                  <td>{new Date(run.generatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                  <td>
                    {run.monitoringPeriodStart && run.monitoringPeriodEnd
                      ? `${ymd(run.monitoringPeriodStart)} – ${ymd(run.monitoringPeriodEnd)}`
                      : "—"}
                  </td>
                  <td>v{run.configurationVersion}</td>
                  <td>{run.classifiedCount}</td>
                  <td>{run.counts.ACTIVE}</td>
                  <td>{run.counts.REQUIRING_ATTENTION}</td>
                  <td>{run.counts.INACTIVE}</td>
                  <td>{run.counts.INSUFFICIENT_DATA}</td>
                  <td>
                    <button type="button" className="text-btn" onClick={() => openRun(run)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {selectedRun && !loading && !error && !results?.results?.items?.length ? (
        <section className="card">
          <p className="lede">
            No student results were returned for this run. Try opening the run again or reload the page.
          </p>
        </section>
      ) : null}

      {results?.results?.items?.length ? (
        <section className="card table-card">
          <h2>Students in this run</h2>
          <p className="lede">
            {selectedRunTitle ? (
              <>
                <strong>{selectedRunTitle}</strong>.{" "}
              </>
            ) : null}
            Monitoring period {periodStart} to {periodEnd}. Configuration v{results.configurationVersion}. Counts stay
            on the snapshot used when the run was generated.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Classification</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {results.results.items.map((item) => (
                <tr key={item.id} className={`row-status-${item.classification}`}>
                  <td>
                    {item.student?.fullName} ({item.student?.matriculationNumber})
                  </td>
                  <td>{item.displayScore == null ? "Not calculated" : `${item.displayScore}/100`}</td>
                  <td>
                    <ClassificationBadge classification={item.classification} />
                  </td>
                  <td>
                    <Link to={`/courses/${courseId}/results/${item.id}`}>View evidence</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}