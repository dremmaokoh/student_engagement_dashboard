import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ContentSkeleton from "../components/common/ContentSkeleton.jsx";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { formatRunTitle } from "../lib/classificationRuns.js";
import { courseOverviewPath, readCoursePeriod } from "../lib/coursePeriod.js";
import { serialNumber } from "../lib/serialNumber.js";
import { apiRequest, downloadAuthenticated } from "../services/api.js";

const RESULTS_PAGE_SIZE = 50;

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
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isActiveRef = useRef(true);
  const resultsRequestRef = useRef(0);

  function syncUrlToSelection(period, runId) {
    if (!isActiveRef.current || !runId || !period?.periodStart || !period?.periodEnd) {
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

  async function loadRunResults(runId, runRow, page = 1) {
    const dashPeriod = runPeriod(runRow);
    if (!dashPeriod) {
      setResults(null);
      return;
    }
    const requestId = ++resultsRequestRef.current;
    setResultsLoading(true);
    const dashParams = new URLSearchParams({
      periodStart: dashPeriod.periodStart,
      periodEnd: dashPeriod.periodEnd,
      runId,
      limit: String(RESULTS_PAGE_SIZE),
      page: String(page),
    });
    try {
      const dash = await apiRequest(`/api/v1/courses/${courseId}/dashboard?${dashParams.toString()}`);
      if (!isActiveRef.current || requestId !== resultsRequestRef.current) {
        return;
      }
      setResults(dash.data);
      setPeriodStart(dashPeriod.periodStart);
      setPeriodEnd(dashPeriod.periodEnd);
      setResultsPage(page);
    } finally {
      if (isActiveRef.current && requestId === resultsRequestRef.current) {
        setResultsLoading(false);
      }
    }
  }

  async function loadHistory(preferredRunId) {
    setLoading(true);
    setError("");
    try {
      const courseResult = await apiRequest(`/api/v1/courses/${courseId}`);
      if (!isActiveRef.current) {
        return;
      }
      setCourse(courseResult.data.course);

      const history = await apiRequest(`/api/v1/courses/${courseId}/classification-runs?scope=all`);
      if (!isActiveRef.current) {
        return;
      }
      const items = history.data.items || [];
      setRuns(items);

      const chosenRunId =
        preferredRunId && items.some((row) => row.runId === preferredRunId)
          ? preferredRunId
          : items[0]?.runId || "";

      setSelectedRun(chosenRunId);
      const chosenRunRow = items.find((row) => row.runId === chosenRunId);

      if (chosenRunId && chosenRunRow) {
        setResultsPage(1);
        await loadRunResults(chosenRunId, chosenRunRow, 1);
        if (!isActiveRef.current) {
          return;
        }
        syncUrlToSelection(runPeriod(chosenRunRow), chosenRunId);
      } else {
        setResults(null);
        setResultsPage(1);
        setPeriodStart("");
        setPeriodEnd("");
      }
    } catch (err) {
      if (!isActiveRef.current) {
        return;
      }
      setError(err.message);
    } finally {
      if (isActiveRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    isActiveRef.current = true;
    const runFromUrl = searchParams.get("runId") || undefined;
    loadHistory(runFromUrl);
    return () => {
      isActiveRef.current = false;
    };
  }, [courseId, searchParams.get("runId")]);

  async function openRun(run) {
    const runId = run.runId;
    setSelectedRun(runId);
    setResultsPage(1);
    setError("");
    try {
      await loadRunResults(runId, run);
      syncUrlToSelection(runPeriod(run), runId);
    } catch (err) {
      if (!isActiveRef.current) {
        return;
      }
      setError(err.message);
    }
  }

  const exportPeriod = selectedRun ? runPeriod(runs.find((row) => row.runId === selectedRun)) : null;
  const selectedRunRow = runs.find((row) => row.runId === selectedRun);
  const selectedRunTitle = selectedRunRow ? formatRunTitle(course?.code, selectedRunRow.runName) : null;
  const resultsTotalPages = results?.results?.totalPages || 1;
  const resultsTotal = results?.results?.total || 0;

  function changeResultsPage(page) {
    if (!isActiveRef.current || !selectedRun || !selectedRunRow || page < 1 || page > resultsTotalPages) {
      return;
    }
    setError("");
    loadRunResults(selectedRun, selectedRunRow, page).catch((err) => {
      if (isActiveRef.current) {
        setError(err.message);
      }
    });
  }

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
        <ContentSkeleton
          loading={loading}
          variant="table"
          rows={4}
          columns={6}
          label="Retrieving assessment history…"
        />
        {!loading && !error && runs.length === 0 ? (
          <p className="lede">No classification runs yet. Generate classifications from Monitoring.</p>
        ) : null}
        {runs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Run name</th>
                <th>Generated</th>
                <th>Monitoring period</th>
                <th>Config</th>
                <th>Students</th>
                <th>Active</th>
                <th>Requiring Attention</th>
                <th>Inactive</th>
                <th>Insufficient</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, index) => (
                <tr key={run.runId} className={run.runId === selectedRun ? "row-selected" : undefined}>
                  <td className="col-serial">{index + 1}</td>
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

      {selectedRun && !loading && !resultsLoading && !error && !results?.results?.items?.length ? (
        <section className="card">
          <p className="lede">
            No student results were returned for this run. Try opening the run again or reload the page.
          </p>
        </section>
      ) : null}

      {resultsLoading || results?.results?.items?.length ? (
        <section className="card table-card">
          <h2>Students in this run</h2>
          <p className="lede">
            {selectedRunTitle ? (
              <>
                <strong>{selectedRunTitle}</strong>.{" "}
              </>
            ) : null}
            Monitoring period {periodStart} to {periodEnd}.
            {results ? ` Configuration v${results.configurationVersion}.` : ""} Counts stay on the snapshot used when the
            run was generated.
          </p>
          <ContentSkeleton
            loading={resultsLoading}
            variant="table"
            rows={5}
            columns={5}
            label="Loading results…"
          />
          {!resultsLoading && results?.results?.items?.length ? (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="col-serial">S/N</th>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Classification</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.items.map((item, index) => (
                    <tr key={item.id} className={`row-status-${item.classification}`}>
                      <td className="col-serial">
                        {serialNumber(index, { page: results.results.page, limit: results.results.limit })}
                      </td>
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
              {resultsTotalPages > 1 ? (
                <div className="table-pager">
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={resultsPage <= 1}
                    onClick={() => changeResultsPage(resultsPage - 1)}
                  >
                    Previous
                  </button>
                  <span className="muted">
                    Page {resultsPage} of {resultsTotalPages} · {resultsTotal} students
                  </span>
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={resultsPage >= resultsTotalPages}
                    onClick={() => changeResultsPage(resultsPage + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}