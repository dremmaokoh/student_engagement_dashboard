import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ContentSkeleton, {
  SkeletonBar,
  SkeletonPageHeader,
  SkeletonPanel,
  SkeletonTable,
} from "../components/common/ContentSkeleton.jsx";
import { skeletonColumns } from "../lib/skeletonColumns.js";
import CourseActivityImportModal from "../components/courses/CourseActivityImportModal.jsx";
import CourseConfigurationModal from "../components/courses/CourseConfigurationModal.jsx";
import CourseEnrolmentModal from "../components/courses/CourseEnrolmentModal.jsx";
import CourseGenerateClassificationModal from "../components/courses/CourseGenerateClassificationModal.jsx";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import CourseTemplateDownloadModal from "../components/courses/CourseTemplateDownloadModal.jsx";
import LatestImportSummary from "../components/courses/LatestImportSummary.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import { formatScore } from "../lib/classifications.js";
import { formatRunTitle } from "../lib/classificationRuns.js";
import { courseOverviewPath, courseResultsPath, readCoursePeriod } from "../lib/coursePeriod.js";
import { studentDetailPath } from "../lib/studentDirectory.js";
import { returnNavigationState } from "../lib/returnNavigation.js";
import { serialNumber } from "../lib/serialNumber.js";
import { useApiAction } from "../hooks/useApiAction.js";
import { apiRequest } from "../services/api.js";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const CLASSIFICATION_FILTERS = [
  { id: "", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "REQUIRING_ATTENTION", label: "Requiring Attention" },
  { id: "INACTIVE", label: "Inactive" },
  { id: "INSUFFICIENT_DATA", label: "Insufficient Data" },
];

export default function CourseMonitoringPage() {
  const { courseId } = useParams();
  const run = useApiAction();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedPeriod = readCoursePeriod(searchParams);
  const classification = searchParams.get("classification") || "";
  const sortBy = searchParams.get("sortBy") || "fullName";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get("limit")))
    ? Number(searchParams.get("limit"))
    : DEFAULT_PAGE_SIZE;
  const appliedSearch = searchParams.get("q") || "";

  const [course, setCourse] = useState(null);
  const [roster, setRoster] = useState({ items: [], total: 0, page: 1, limit: pageSize, totalPages: 1 });
  const [dashboard, setDashboard] = useState(null);
  const [searchInput, setSearchInput] = useState(appliedSearch);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resultsLinkPeriod, setResultsLinkPeriod] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [enrolModalOpen, setEnrolModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [preparedPeriod, setPreparedPeriod] = useState(null);
  const isActiveRef = useRef(true);

  const monitoringPath = `${location.pathname}${location.search}`;
  const returnState = returnNavigationState(monitoringPath, "Back to Monitoring");

  useEffect(() => {
    if (searchParams.get("openImport") === "1") {
      setImportModalOpen(true);
    }
    if (searchParams.get("openConfig") === "1") {
      setConfigModalOpen(true);
    }
    if (searchParams.get("openEnrol") === "1") {
      setEnrolModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setSearchInput(appliedSearch);
  }, [appliedSearch]);

  function updateParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    params.delete("openImport");
    params.delete("openConfig");
    params.delete("openEnrol");
    setSearchParams(params);
  }

  function periodFromDashboard(dash, fallback) {
    const roster = dash?.data?.rosterPeriod;
    if (roster?.monitoringPeriodStart && roster?.monitoringPeriodEnd) {
      return {
        periodStart: roster.monitoringPeriodStart,
        periodEnd: roster.monitoringPeriodEnd,
      };
    }
    const effective = dash?.data?.effectivePeriod;
    if (effective?.monitoringPeriodStart && effective?.monitoringPeriodEnd) {
      return {
        periodStart: effective.monitoringPeriodStart,
        periodEnd: effective.monitoringPeriodEnd,
      };
    }
    return fallback;
  }

  function syncUrlPeriod({ periodStart, periodEnd }) {
    updateParams({ periodStart, periodEnd, page: "1" });
  }

  async function load(periodOverride = null) {
    setLoading(true);
    setError("");
    setRoster((current) => ({ ...current, items: [] }));
    const fallbackPeriod = periodOverride || appliedPeriod;
    try {
      const dashParams = new URLSearchParams({
        periodStart: fallbackPeriod.periodStart,
        periodEnd: fallbackPeriod.periodEnd,
        page: "1",
        limit: "1",
      });
      const [courseResult, dash] = await Promise.all([
        apiRequest(`/api/v1/courses/${courseId}`),
        apiRequest(`/api/v1/courses/${courseId}/dashboard?${dashParams.toString()}`),
      ]);
      const workPeriod = periodFromDashboard(dash, fallbackPeriod);
      const rosterParams = new URLSearchParams({
        limit: String(pageSize),
        page: String(page),
        sortBy,
        periodStart: workPeriod.periodStart,
        periodEnd: workPeriod.periodEnd,
      });
      if (appliedSearch.trim()) {
        rosterParams.set("q", appliedSearch.trim());
      }
      if (classification) {
        rosterParams.set("classification", classification);
      }
      const enrolled = await apiRequest(`/api/v1/courses/${courseId}/students?${rosterParams.toString()}`);
      if (!isActiveRef.current) {
        return;
      }
      setCourse(courseResult.data.course);
      setDashboard(dash.data);
      setRoster({
        items: enrolled.data.items,
        total: enrolled.data.total,
        page: enrolled.data.page,
        limit: enrolled.data.limit,
        totalPages: enrolled.data.totalPages,
      });
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
    load();
    return () => {
      isActiveRef.current = false;
    };
  }, [
    courseId,
    appliedPeriod.periodStart,
    appliedPeriod.periodEnd,
    classification,
    sortBy,
    page,
    pageSize,
    appliedSearch,
  ]);

  const latestImport = dashboard?.latestImport;
  const canGenerate = Boolean(latestImport?.confirmedAt && (latestImport?.importedCount ?? 0) > 0);
  const generateDisabledReason = !latestImport
    ? "No confirmed activity import yet. Import and confirm activity data before generating classifications."
    : (latestImport.importedCount ?? 0) <= 0
      ? "The latest import has no accepted activity records. Import a valid file before generating."
      : "";

  const importModalPeriod =
    preparedPeriod ||
    (latestImport?.monitoringPeriodStart && latestImport?.monitoringPeriodEnd
      ? {
          periodStart: latestImport.monitoringPeriodStart,
          periodEnd: latestImport.monitoringPeriodEnd,
        }
      : appliedPeriod);

  const templateModalPeriod =
    preparedPeriod ||
    (latestImport?.monitoringPeriodStart && latestImport?.monitoringPeriodEnd
      ? {
          periodStart: latestImport.monitoringPeriodStart,
          periodEnd: latestImport.monitoringPeriodEnd,
        }
      : appliedPeriod);

  function openGenerateModal() {
    if (!canGenerate) {
      setError(generateDisabledReason || "Cannot generate classifications yet.");
      return;
    }
    setGenerateModalOpen(true);
  }

  async function generate(runName) {
    if (!canGenerate) {
      setError(generateDisabledReason || "Cannot generate classifications yet.");
      return;
    }
    setGenerating(true);
    setError("");
    setSuccess("");
    setResultsLinkPeriod(null);
    try {
      const response = await run(
        () =>
          apiRequest(`/api/v1/courses/${courseId}/classifications/generate`, {
            method: "POST",
            body: { runName },
          }),
        {
          loading: "Generating classification…",
          success: (result) => {
            const count = result?.data?.generatedCount ?? 0;
            return `Classification generated for ${course?.code || "course"}: ${count} student${count === 1 ? "" : "s"} classified.`;
          },
          rethrow: true,
        },
      );
      const result = response.data;
      const runId = result.data?.runId;
      const savedRunName = result.data?.runName;
      const effectivePeriod = result.data?.period;
      const periodForNav = effectivePeriod
        ? {
            periodStart: String(effectivePeriod.monitoringPeriodStart || importModalPeriod.periodStart).slice(0, 10),
            periodEnd: String(effectivePeriod.monitoringPeriodEnd || importModalPeriod.periodEnd).slice(0, 10),
          }
        : importModalPeriod;
      if (!isActiveRef.current) {
        return;
      }
      setResultsLinkPeriod(periodForNav);
      syncUrlPeriod(periodForNav);
      await load(periodForNav);
      if (!isActiveRef.current) {
        return;
      }
      const generatedCount = result.data?.generatedCount ?? 0;
      const counts = result.data?.counts || {};
      const runTitle = formatRunTitle(course?.code, savedRunName || runName);
      setSuccess(
        `${runTitle}: classified ${generatedCount} student${generatedCount === 1 ? "" : "s"} ` +
          `(${periodForNav.periodStart} to ${periodForNav.periodEnd}). ` +
          `Active ${counts.ACTIVE ?? 0}, attention ${counts.REQUIRING_ATTENTION ?? 0}, ` +
          `inactive ${counts.INACTIVE ?? 0}, insufficient ${counts.INSUFFICIENT_DATA ?? 0}.`,
      );
      setGenerateModalOpen(false);
      if (runId) {
        navigate(courseResultsPath(courseId, { ...periodForNav, runId }));
      }
    } catch (err) {
      if (!isActiveRef.current) {
        return;
      }
      setError(err.message);
    } finally {
      if (isActiveRef.current) {
        setGenerating(false);
      }
    }
  }

  if (loading && !course) {
    return (
      <main className="content course-monitoring-page">
        <ContentSkeleton loading label="Preparing monitoring workspace…">
          <SkeletonPageHeader />
          <section className="card course-monitoring-toolbar-card" aria-hidden="true">
            <div className="course-monitoring-toolbar">
              <div className="course-monitoring-toolbar-primary">
                <SkeletonBar className="skeleton-button" width="180px" />
                <SkeletonBar className="skeleton-button" width="130px" />
                <SkeletonBar className="skeleton-button" width="170px" />
              </div>
              <div className="course-monitoring-toolbar-secondary">
                <SkeletonBar className="skeleton-button" width="150px" />
                <SkeletonBar className="skeleton-button" width="180px" />
              </div>
            </div>
          </section>
          <SkeletonPanel
            className="card course-monitoring-import-summary"
            titleWidth="34%"
            showTitle
            lines={["72%", "58%"]}
          >
            <dl
              className="activity-import-used-dl course-monitoring-import-dl course-monitoring-import-dl-compact"
              aria-hidden="true"
            >
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index}>
                  <dt>
                    <SkeletonBar width="70%" height={10} />
                  </dt>
                  <dd>
                    <SkeletonBar width="86%" height={14} />
                  </dd>
                </div>
              ))}
            </dl>
          </SkeletonPanel>
          <SkeletonPanel className="card course-students-roster-card" titleWidth="26%" showTitle>
            <SkeletonTable
              columns={skeletonColumns("roster")}
              rows={6}
              tableClassName="students-directory-table course-students-roster-table"
              wrapClassName="table-card students-table-wrap"
              showFooter
            />
          </SkeletonPanel>
        </ContentSkeleton>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="content course-monitoring-page">
        <p className="form-error">{error || "Course not found."}</p>
        <Link to="/courses">Back to Courses</Link>
      </main>
    );
  }

  const pageStart = roster.total === 0 ? 0 : (roster.page - 1) * roster.limit + 1;
  const pageEnd = roster.total === 0 ? 0 : Math.min((roster.page - 1) * roster.limit + roster.items.length, roster.total);

  return (
    <main className="content course-monitoring-page">
      <header className="content-header page-context-header course-monitoring-header">
        <BackLink fallbackTo="/courses" fallbackLabel="Back to Courses" />
        <Breadcrumbs
          items={[
            { label: "Overview", to: "/overview" },
            { label: "Courses", to: "/courses" },
            {
              label: course.code,
              to: courseOverviewPath(courseId, appliedPeriod),
            },
            { label: "Monitoring" },
          ]}
        />
        <h1>Monitoring</h1>
        <p className="lede course-monitoring-lede">
          {course.code} — {course.name}. Manage enrolled students, import course activity and generate engagement
          classifications.
        </p>
        <div className="course-monitoring-period-notes">
          {loading ? (
            <>
              <SkeletonBar width="52%" />
              <SkeletonBar width="44%" />
            </>
          ) : (
            <>
              <p className="panel-desc course-monitoring-period-note">
                {latestImport?.monitoringPeriodStart && latestImport?.monitoringPeriodEnd ? (
                  <>
                    Latest imported activity period: {latestImport.monitoringPeriodStart} to{" "}
                    {latestImport.monitoringPeriodEnd}.
                  </>
                ) : (
                  <>No confirmed activity import yet. Choose a monitoring period when you download an activity template.</>
                )}
              </p>
              {dashboard?.latestClassification ? (
                <p className="panel-desc course-monitoring-period-note">
                  Latest generated classification period: {dashboard.latestClassification.monitoringPeriodStart || "—"} to{" "}
                  {dashboard.latestClassification.monitoringPeriodEnd || "—"}
                  {dashboard.latestClassification.generatedAt
                    ? ` (generated ${new Date(dashboard.latestClassification.generatedAt).toLocaleString()})`
                    : ""}
                  .
                </p>
              ) : null}
            </>
          )}
        </div>
      </header>
      <CourseTabs courseId={courseId} />

      <section className="card course-monitoring-toolbar-card" aria-label="Workflow actions">
        <div className="course-monitoring-toolbar">
          <div className="course-monitoring-toolbar-primary">
            <button type="button" className="secondary-btn" onClick={() => setTemplateModalOpen(true)}>
              Download Activity Template
            </button>
            <button type="button" className="secondary-btn" onClick={() => setImportModalOpen(true)}>
              Import Activity
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={openGenerateModal}
              disabled={generating || !canGenerate}
              title={!canGenerate ? generateDisabledReason : undefined}
              aria-describedby={!canGenerate ? "generate-classifications-hint" : undefined}
            >
              {generating ? "Generating…" : "Generate Classifications"}
            </button>
          </div>
          <div className="course-monitoring-toolbar-secondary">
            <button type="button" className="secondary-btn" onClick={() => setConfigModalOpen(true)}>
              View Configuration
            </button>
            <button type="button" className="secondary-btn" onClick={() => setEnrolModalOpen(true)}>
              + Add Students to Course
            </button>
          </div>
        </div>
        {!canGenerate && generateDisabledReason ? (
          <p id="generate-classifications-hint" className="panel-desc course-monitoring-generate-hint" role="status">
            {generateDisabledReason}
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="students-success" role="status">
            {success}{" "}
            <Link to={courseResultsPath(courseId, resultsLinkPeriod || appliedPeriod)}>View Results &amp; History</Link>
          </p>
        ) : null}
      </section>

      <LatestImportSummary latestImport={dashboard?.latestImport} loading={loading} />

      <section className="card course-students-roster-card">
        <div className="course-students-roster-head">
          <div>
            <h2>Roster</h2>
            <p className="panel-desc course-students-roster-count">
              {loading ? "…" : `${roster.total} enrolled student${roster.total === 1 ? "" : "s"}`}
              {classification
                ? ` · filtered by ${CLASSIFICATION_FILTERS.find((f) => f.id === classification)?.label || classification}`
                : ""}
            </p>
          </div>
        </div>

        <form
          className="course-students-search-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: searchInput.trim(), page: "1" });
          }}
        >
          <label className="sr-only" htmlFor="courseStudentSearch">
            Search students
          </label>
          <input
            id="courseStudentSearch"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name or student ID…"
          />
          <label className="sr-only" htmlFor="courseStudentSort">
            Sort by
          </label>
          <select
            id="courseStudentSort"
            value={sortBy}
            onChange={(event) => updateParams({ sortBy: event.target.value, page: "1" })}
          >
            <option value="fullName">Student name</option>
            <option value="matriculationNumber">Student ID</option>
            <option value="overallScore">Engagement score</option>
            <option value="classification">Classification</option>
          </select>
          <button type="submit" className="secondary-btn">
            Search
          </button>
        </form>

        <div className="course-students-filter-chips" role="tablist" aria-label="Filter by classification">
          {CLASSIFICATION_FILTERS.map((filter) => (
            <button
              key={filter.id || "all"}
              type="button"
              role="tab"
              aria-selected={classification === filter.id}
              className={classification === filter.id ? "course-students-chip is-selected" : "course-students-chip"}
              onClick={() => updateParams({ classification: filter.id, page: "1" })}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <ContentSkeleton
          loading={loading}
          variant="table"
          columns={skeletonColumns("roster")}
          rows={6}
          tableClassName="students-directory-table course-students-roster-table"
          wrapClassName="table-card students-table-wrap"
          showFooter
          label="Loading roster…"
        />
        {!loading && roster.items.length === 0 ? (
          <div className="students-empty students-empty-compact">
            <strong>No students to show</strong>
            <p>
              {roster.total === 0 && !appliedSearch && !classification
                ? "No students are enrolled. Use Add Students to Course or enrol from the Students module."
                : "No students match your search or filters for this monitoring period."}
            </p>
          </div>
        ) : null}
        {!loading && roster.items.length > 0 ? (
          <div className="table-card students-table-wrap">
            <table className="data-table students-directory-table course-students-roster-table">
              <thead>
                <tr>
                  <th className="col-serial">S/N</th>
                  <th>Student Name</th>
                  <th className="course-overview-col-id">Student ID</th>
                  <th className="course-overview-col-score">Engagement Score</th>
                  <th>Classification</th>
                  <th className="students-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {roster.items.map((row, index) => {
                  const detailPath = studentDetailPath(row.student?.id || row.studentId);
                  const hasResult = Boolean(row.resultId || row.classification);
                  return (
                    <tr key={row.id} className={row.classification ? `row-status-${row.classification}` : undefined}>
                      <td className="col-serial">
                        {serialNumber(index, { page: roster.page, limit: roster.limit })}
                      </td>
                      <td className="students-col-name">
                        <span className="student-name" title={row.student?.fullName}>
                          {row.student?.fullName}
                        </span>
                      </td>
                      <td className="course-overview-col-id">
                        <span className="id-badge">{row.student?.matriculationNumber}</span>
                      </td>
                      <td className="course-overview-col-score">{formatScore(row.displayScore)}</td>
                      <td>
                        {row.classification ? (
                          <ClassificationBadge classification={row.classification} />
                        ) : (
                          <span className="muted">Not yet classified</span>
                        )}
                      </td>
                      <td className="students-col-action">
                        {detailPath ? (
                          <Link className="text-btn students-view-btn" to={detailPath} {...returnState}>
                            View Student →
                          </Link>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && roster.total > 0 ? (
          <footer className="students-table-footer">
            <p className="muted students-footer-summary">
              Showing {pageStart}–{pageEnd} of {roster.total} students
            </p>
            <div className="students-footer-controls">
              <label className="students-rows-label" htmlFor="rosterPageSize">
                Rows
              </label>
              <select
                id="rosterPageSize"
                value={pageSize}
                onChange={(event) => updateParams({ limit: event.target.value, page: "1" })}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-btn"
                disabled={roster.page <= 1}
                onClick={() => updateParams({ page: String(roster.page - 1) })}
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={roster.page >= roster.totalPages}
                onClick={() => updateParams({ page: String(roster.page + 1) })}
              >
                Next
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      <CourseTemplateDownloadModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        courseId={courseId}
        courseCode={course.code}
        initialPeriodStart={templateModalPeriod.periodStart}
        initialPeriodEnd={templateModalPeriod.periodEnd}
        onPeriodConfirmed={({ periodStart, periodEnd }) => {
          setPreparedPeriod({ periodStart, periodEnd });
        }}
      />
      <CourseActivityImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        courseId={courseId}
        courseCode={course.code}
        periodStart={importModalPeriod.periodStart}
        periodEnd={importModalPeriod.periodEnd}
        onImportConfirmed={(importMeta) => {
          if (importMeta?.monitoringPeriodStart && importMeta?.monitoringPeriodEnd) {
            setPreparedPeriod({
              periodStart: String(importMeta.monitoringPeriodStart).slice(0, 10),
              periodEnd: String(importMeta.monitoringPeriodEnd).slice(0, 10),
            });
          }
          load();
          const importedCount = Number(importMeta?.importedCount ?? 0);
          const skippedCount = Number(importMeta?.skippedCount ?? 0);
          setSuccess(
            `Activity import confirmed: ${importedCount} record${importedCount === 1 ? "" : "s"} imported` +
              `${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}. Latest import details updated below.`,
          );
        }}
      />
      <CourseConfigurationModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        courseId={courseId}
        periodStart={appliedPeriod.periodStart}
        periodEnd={appliedPeriod.periodEnd}
      />
      <CourseEnrolmentModal
        open={enrolModalOpen}
        onClose={() => setEnrolModalOpen(false)}
        courseId={courseId}
        courseCode={course?.code}
        onEnrolled={(enrolledCount = 1, failedCount = 0) => {
          load();
          const enrolledLabel = `${enrolledCount} student${enrolledCount === 1 ? "" : "s"}`;
          setSuccess(
            failedCount > 0
              ? `${enrolledLabel} enrolled in this course; ${failedCount} could not be enrolled.`
              : `${enrolledLabel} enrolled in this course.`,
          );
        }}
      />
      <CourseGenerateClassificationModal
        open={generateModalOpen}
        onClose={() => {
          if (!generating) {
            setGenerateModalOpen(false);
          }
        }}
        courseCode={course?.code}
        courseName={course?.name}
        periodStart={importModalPeriod.periodStart}
        periodEnd={importModalPeriod.periodEnd}
        generating={generating}
        onGenerate={(name) => generate(name)}
      />
    </main>
  );
}