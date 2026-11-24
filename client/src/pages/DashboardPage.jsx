import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import LoadingState from "../components/common/LoadingState.jsx";
import ClassificationCoverageCard from "../components/dashboard/ClassificationCoverageCard.jsx";
import ClassificationTrendFilter from "../components/dashboard/ClassificationTrendFilter.jsx";
import CourseComparison from "../components/dashboard/CourseComparison.jsx";
import DataFreshnessStrip from "../components/dashboard/DataFreshnessStrip.jsx";
import DonutChart from "../components/dashboard/DonutChart.jsx";
import GeneralOverviewSingleCoursePanel from "../components/dashboard/GeneralOverviewSingleCoursePanel.jsx";
import GeneralOverviewTrendChart from "../components/dashboard/GeneralOverviewTrendChart.jsx";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import SummaryCard from "../components/design/SummaryCard.jsx";
import StatusIcon from "../components/design/StatusIcon.jsx";
import { formatScore, INSUFFICIENT_DATA_HELP } from "../lib/classifications.js";
import { ALL_CLASSIFICATIONS } from "../lib/classificationTrend.js";
import { studentDetailPath } from "../lib/studentDirectory.js";
import { formatLastRecordedActivity } from "../lib/formatLastActivity.js";
import {
  PERIOD_PRESETS,
  buildDashboardQueryParams,
  isLatestPeriodPreset,
  periodFromPreset,
} from "../lib/periodPresets.js";
import { returnNavigationState } from "../lib/returnNavigation.js";
import { serialNumber } from "../lib/serialNumber.js";
import { apiRequest } from "../services/api.js";

const TABLE_LIMIT = 25;
const CLASSIFICATION_KPI_KEYS = ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"];

const emptyCounts = {
  total: 0,
  ACTIVE: 0,
  REQUIRING_ATTENTION: 0,
  INACTIVE: 0,
  INSUFFICIENT_DATA: 0,
};

function presetLabel(value) {
  return PERIOD_PRESETS.find((item) => item.value === value)?.label || "Custom";
}

const KPI_LABELS = {
  FOLLOWUP: "Needing follow-up",
  ALL: "All classified enrolments",
  ACTIVE: "Active",
  REQUIRING_ATTENTION: "Requiring Attention",
  INACTIVE: "Inactive",
  INSUFFICIENT_DATA: "Insufficient data",
};

function classificationFromKpi(kpi) {
  if (kpi === "FOLLOWUP" || kpi === "ALL" || kpi === "ENROLLED") {
    return "";
  }
  return kpi;
}

function tableFocusFromKpi(kpi) {
  if (kpi === "FOLLOWUP") {
    return "followup";
  }
  return "all";
}

export default function DashboardPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnToOverview = returnNavigationState(
    `${location.pathname}${location.search}`,
    "Back to Overview",
  );
  const courseId = searchParams.get("courseId") || "all";
  const preset = searchParams.get("preset") || "all";
  const kpiFilter = searchParams.get("kpi") || "FOLLOWUP";
  const tablePage = Math.max(1, Number.parseInt(searchParams.get("tablePage") || "1", 10) || 1);

  const [customStart, setCustomStart] = useState(searchParams.get("periodStart") || "2026-10-01");
  const [customEnd, setCustomEnd] = useState(searchParams.get("periodEnd") || "2026-10-31");
  const periodScope = isLatestPeriodPreset(preset) ? "latest" : "fixed";
  const period = useMemo(() => {
    if (isLatestPeriodPreset(preset)) {
      return null;
    }
    return periodFromPreset(
      preset,
      searchParams.get("periodStart") || customStart,
      searchParams.get("periodEnd") || customEnd,
    );
  }, [preset, searchParams, customStart, customEnd]);

  const dashboardParams = useMemo(
    () =>
      buildDashboardQueryParams({
        courseId,
        preset,
        customStart: searchParams.get("periodStart") || customStart,
        customEnd: searchParams.get("periodEnd") || customEnd,
      }),
    [courseId, preset, searchParams, customStart, customEnd],
  );
  const dashboardQueryKey = dashboardParams.toString();

  const [courses, setCourses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [trend, setTrend] = useState(null);
  const [generalTrendFilter, setGeneralTrendFilter] = useState(ALL_CLASSIFICATIONS);
  const [singleCourseRuns, setSingleCourseRuns] = useState([]);
  const [singleCourseRunsLoading, setSingleCourseRunsLoading] = useState(false);
  const [tableRows, setTableRows] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [appliedTableSearch, setAppliedTableSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedCourse = useMemo(
    () => (courseId === "all" ? null : courses.find((course) => course.id === courseId)),
    [courseId, courses],
  );

  const tableClassification = classificationFromKpi(kpiFilter);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/v1/courses?limit=100")
      .then((result) => {
        if (!cancelled) {
          setCourses(result.data.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCourses([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const requests = [
          apiRequest(`/api/v1/dashboard/summary?${dashboardQueryKey}`),
          apiRequest(`/api/v1/dashboard/course-comparison?${dashboardQueryKey}`),
          apiRequest(`/api/v1/dashboard/trend?${dashboardQueryKey}`),
        ];
        if (courseId !== "all") {
          setSingleCourseRunsLoading(true);
        }
        const [summaryResult, comparisonResult, trendResult] = await Promise.all(requests);
        if (cancelled) {
          return;
        }
        setSummary(summaryResult.data);
        setComparison(comparisonResult.data);
        setTrend(trendResult.data);
        if (courseId !== "all") {
          try {
            const runsResult = await apiRequest(`/api/v1/courses/${courseId}/classification-runs?scope=all`);
            if (!cancelled) {
              setSingleCourseRuns(runsResult.data.items || []);
            }
          } catch {
            if (!cancelled) {
              setSingleCourseRuns([]);
            }
          } finally {
            if (!cancelled) {
              setSingleCourseRunsLoading(false);
            }
          }
        } else {
          setSingleCourseRuns([]);
          setSingleCourseRunsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, dashboardQueryKey]);

  useEffect(() => {
    if (!summary || summary.state === "no_courses" || summary.state === "no_enrolments") {
      return;
    }
    let cancelled = false;
    async function loadTable() {
      setTableLoading(true);
      try {
        const params = new URLSearchParams(dashboardParams);
        params.set("limit", String(TABLE_LIMIT));
        params.set("page", String(tablePage));
        if (appliedTableSearch) {
          params.set("q", appliedTableSearch);
        }
        if (tableClassification) {
          params.set("classification", tableClassification);
        } else {
          params.set("focus", tableFocusFromKpi(kpiFilter === "ENROLLED" ? "ALL" : kpiFilter));
        }
        const result = await apiRequest(`/api/v1/dashboard/attention-students?${params.toString()}`);
        if (!cancelled) {
          setTableRows(result.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setTableLoading(false);
        }
      }
    }
    loadTable();
    return () => {
      cancelled = true;
    };
  }, [courseId, dashboardQueryKey, dashboardParams, kpiFilter, tableClassification, appliedTableSearch, tablePage, summary]);

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  }

  function setKpiFilter(next) {
    const resolved = next === "ENROLLED" ? "ALL" : next;
    updateFilters({ kpi: resolved, tablePage: "1" });
  }

  function toggleClassificationFilter(next) {
    if (kpiFilter === next) {
      updateFilters({ kpi: "FOLLOWUP", tablePage: "1" });
      return;
    }
    setKpiFilter(next);
  }

  function clearTableFilters() {
    setTableSearch("");
    setAppliedTableSearch("");
    updateFilters({ kpi: "FOLLOWUP", tablePage: "1" });
  }

  const hasTableFilters =
    appliedTableSearch.length > 0 || (kpiFilter && kpiFilter !== "FOLLOWUP");

  const legendSelection = CLASSIFICATION_KPI_KEYS.includes(kpiFilter) ? kpiFilter : null;

  function studentsLink(classification) {
    const params = new URLSearchParams(dashboardParams);
    if (courseId !== "all") {
      params.set("courseId", courseId);
    }
    if (classification) {
      params.set("classification", classification);
    }
    return `/students?${params.toString()}`;
  }

  const counts = summary?.counts || emptyCounts;
  const items = tableRows?.results?.items || [];
  const tableTotal = tableRows?.results?.total ?? items.length;
  const tableTotalPages = tableRows?.results?.totalPages ?? 1;

  const distributionSubtitle =
    summary?.enrolledCount != null && summary?.classifiedCount != null
      ? `${summary.classifiedCount} classified enrolments · ${summary.unclassifiedEnrolments ?? 0} not yet classified · ${summary.enrolledCount} total enrolments in scope.`
      : periodScope === "latest"
        ? "Latest classification per course across your portfolio."
        : "Classified course enrolment results for the selected monitoring period.";

  const coverageLines = [];
  if (counts.INSUFFICIENT_DATA > 0) {
    coverageLines.push(
      `${counts.INSUFFICIENT_DATA} enrolment${counts.INSUFFICIENT_DATA === 1 ? "" : "s"} currently have insufficient activity data for this monitoring period.`,
    );
  }
  if (summary?.coursesWithRuns != null && summary?.courseCount != null && summary.coursesWithRuns < summary.courseCount) {
    coverageLines.push(
      `Classification runs exist for ${summary.coursesWithRuns} of ${summary.courseCount} courses in this period; some enrolments may not yet appear.`,
    );
  }
  const coverageNote = coverageLines.length ? coverageLines.join(" ") : null;

  const tableSectionDesc =
    kpiFilter === "FOLLOWUP"
      ? periodScope === "latest"
        ? "Students classified as inactive or requiring attention (latest run per course)."
        : "Students classified as inactive or requiring attention during the selected monitoring period."
      : `Showing enrolments filtered by: ${KPI_LABELS[kpiFilter] || "selection"}.`;

  return (
    <main className="content dashboard-page">
      <header className="dashboard-header-block">
        <h1>Overview</h1>
        <p className="lede dashboard-lede">
          Monitor student activity across your courses and identify students who may require follow-up.
        </p>
      </header>

      <section className="filter-panel filter-panel-compact" aria-label="Dashboard filters">
        <form
          className="filter-panel-grid"
          onSubmit={(event) => {
            event.preventDefault();
            if (isLatestPeriodPreset(preset)) {
              updateFilters({ courseId, preset, periodStart: undefined, periodEnd: undefined, tablePage: "1" });
            } else {
              updateFilters({
                courseId,
                preset,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
                tablePage: "1",
              });
            }
          }}
        >
          <div className="filter-field">
            <label htmlFor="dashboardCourse">Course</label>
            <select
              id="dashboardCourse"
              value={courseId}
              onChange={(event) => updateFilters({ courseId: event.target.value, tablePage: "1" })}
            >
              <option value="all">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="dashboardPreset">Monitoring period</label>
            <select
              id="dashboardPreset"
              value={preset}
              onChange={(event) => {
                const nextPreset = event.target.value;
                if (nextPreset === "all") {
                  updateFilters({ preset: "all", periodStart: undefined, periodEnd: undefined, tablePage: "1" });
                } else if (nextPreset === "custom") {
                  updateFilters({ preset: "custom", periodStart: customStart, periodEnd: customEnd, tablePage: "1" });
                } else {
                  const next = periodFromPreset(nextPreset);
                  updateFilters({
                    preset: nextPreset,
                    periodStart: next.periodStart,
                    periodEnd: next.periodEnd,
                    tablePage: "1",
                  });
                }
              }}
            >
              {PERIOD_PRESETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {preset === "custom" ? (
            <>
              <div className="filter-field">
                <label htmlFor="dashboardStart">Period start</label>
                <input
                  id="dashboardStart"
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
              </div>
              <div className="filter-field">
                <label htmlFor="dashboardEnd">Period end</label>
                <input
                  id="dashboardEnd"
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </div>
              <div className="filter-field filter-field-action">
                <button type="submit" className="primary-btn filter-apply-btn">
                  Apply period
                </button>
              </div>
            </>
          ) : null}
        </form>
        <div className="filter-applied" aria-live="polite">
          <span className="filter-applied-label">Applied:</span>
          <span className="filter-chip">{selectedCourse ? selectedCourse.code : "All courses"}</span>
          <span className="filter-chip">{presetLabel(preset)}</span>
          {isLatestPeriodPreset(preset) ? (
            <span className="filter-chip">Latest classification per course</span>
          ) : (
            <span className="filter-chip">
              {period?.periodStart} → {period?.periodEnd}
            </span>
          )}
        </div>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <LoadingState loading={loading} variant="page" size="lg" message="Preparing your dashboard…" />

      {!loading && summary?.state === "no_courses" ? (
        <section className="card empty-state">
          <h2>No courses yet</h2>
          <p className="lede">Import course and enrolment data to start monitoring student activity.</p>
          <Link className="primary-btn" to="/courses">
            Go to Courses
          </Link>
        </section>
      ) : null}

      {!loading && summary?.state === "no_enrolments" ? (
        <section className="card empty-state">
          <h2>No enrolments in scope</h2>
          <p className="lede">Add students to your courses or widen the course filter to see participation metrics.</p>
          <Link className="secondary-btn" to="/courses">
            Manage courses
          </Link>
        </section>
      ) : null}

      {!loading && summary && summary.state !== "no_courses" && summary.state !== "no_enrolments" ? (
        <>
          <section className="dashboard-kpi-grid dashboard-kpi-seven dashboard-kpi-compact" aria-label="Participation summary">
            <div className="summary-kpi-static">
              <SummaryCard status="ENROLLED" label="Total courses" value={summary.courseCount} />
            </div>
            <div className="summary-kpi-static">
              <SummaryCard
                status="ENROLLED"
                label="Total unique students"
                value={summary.enrolledUniqueStudentCount ?? summary.uniqueStudentCount}
              />
            </div>
            <div className="summary-kpi-static">
              <SummaryCard status="ENROLLED" label="Total enrolments" value={summary.enrolledCount} />
            </div>
            {[
              { key: "ACTIVE", label: "Active", status: "ACTIVE" },
              { key: "REQUIRING_ATTENTION", label: "Requiring Attention", status: "REQUIRING_ATTENTION", emphasis: true },
              { key: "INACTIVE", label: "Inactive", status: "INACTIVE" },
              {
                key: "INSUFFICIENT_DATA",
                label: "Insufficient Data",
                status: "INSUFFICIENT_DATA",
                hint: INSUFFICIENT_DATA_HELP,
              },
            ].map((kpi) => (
              <button
                key={kpi.key}
                type="button"
                className="summary-link summary-kpi-btn"
                aria-pressed={kpiFilter === kpi.key}
                onClick={() => setKpiFilter(kpi.key)}
              >
                <SummaryCard
                  status={kpi.status}
                  label={kpi.label}
                  value={counts[kpi.key]}
                  emphasis={kpi.emphasis}
                  selected={kpiFilter === kpi.key}
                  hint={kpi.hint}
                />
              </button>
            ))}
          </section>

          <ClassificationCoverageCard summary={summary} />

          {summary.state === "no_classifications" ? (
            <section className="card empty-state dashboard-empty-classifications">
              <h2>No classification results for this period</h2>
              <p className="lede">
                Filters only read existing runs. Open a course, import activity if needed, then generate classifications.
              </p>
              <Link className="secondary-btn" to="/courses">
                Open Courses
              </Link>
            </section>
          ) : (
            <section className="card dashboard-panel distribution-hero-panel">
              <DonutChart
                counts={counts}
                subtitle={distributionSubtitle}
                coverageNote={coverageNote}
                centerLabel="classified"
                selectedClassification={legendSelection}
                onSelectClassification={setKpiFilter}
                onToggleClassification={toggleClassificationFilter}
              />
            </section>
          )}

          {courseId !== "all" && selectedCourse ? (
            <GeneralOverviewSingleCoursePanel
              course={selectedCourse}
              period={period}
              periodScope={periodScope}
              summary={summary}
              runs={singleCourseRuns}
              runsLoading={singleCourseRunsLoading}
            />
          ) : (
            <section className="card dashboard-panel course-overview-section" aria-labelledby="dashboard-trend-heading">
              <div className="classification-trend-card-head">
                <h2 id="dashboard-trend-heading">Classification trend</h2>
                <ClassificationTrendFilter value={generalTrendFilter} onChange={setGeneralTrendFilter} />
              </div>
              <GeneralOverviewTrendChart
                trend={trend}
                loading={loading}
                coursesInScope={trend?.coursesInScope ?? summary?.courseCount ?? 0}
                classificationFilter={generalTrendFilter}
              />
            </section>
          )}

          <section className="card dashboard-panel followup-queue" aria-labelledby="followup-queue-heading">
            <div className="attention-queue-header">
              <div>
                <h2 id="followup-queue-heading">Students Requiring Follow-up</h2>
                <p className="panel-desc">
                  {tableSectionDesc}
                  {summary.state !== "no_classifications" ? (
                    <>
                      {" "}
                      Showing <strong>{items.length}</strong> of <strong>{tableTotal}</strong> matching enrolments.
                    </>
                  ) : null}
                </p>
              </div>
              <Link className="text-btn" to={studentsLink("")}>
                View all students →
              </Link>
            </div>

            {summary.state !== "no_classifications" ? (
              <form
                className="followup-toolbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAppliedTableSearch(tableSearch.trim());
                  updateFilters({ tablePage: "1" });
                }}
              >
                <label className="visually-hidden" htmlFor="followupSearch">
                  Search students
                </label>
                <input
                  id="followupSearch"
                  type="search"
                  placeholder="Search by name or identifier"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                />
                <button type="submit" className="secondary-btn followup-search-btn">
                  Search
                </button>
                {hasTableFilters ? (
                  <button type="button" className="text-btn" onClick={clearTableFilters}>
                    Clear table filters
                  </button>
                ) : null}
                <LoadingState
                  loading={tableLoading}
                  variant="inline"
                  size="sm"
                  message="Refreshing engagement table…"
                />
              </form>
            ) : null}

            {summary.state !== "no_classifications" && hasTableFilters ? (
              <div className="table-filter-chips" aria-live="polite">
                {kpiFilter !== "FOLLOWUP" ? (
                  <span className="filter-chip">View: {KPI_LABELS[kpiFilter] || kpiFilter}</span>
                ) : null}
                {appliedTableSearch ? <span className="filter-chip">Search: {appliedTableSearch}</span> : null}
              </div>
            ) : null}

            {summary.state === "no_classifications" ? (
              <p className="followup-empty-compact">
                No classification run for this monitoring period yet. Open a course, import activity if needed, then
                generate classifications.
              </p>
            ) : items.length === 0 && !tableLoading ? (
              appliedTableSearch ? (
                <p className="followup-empty-compact">
                  <strong>No matching students</strong> — No enrolments match &ldquo;{appliedTableSearch}&rdquo; for the
                  current view. <button type="button" className="text-btn" onClick={clearTableFilters}>Clear table filters</button>
                </p>
              ) : kpiFilter === "FOLLOWUP" ? (
                <div className="followup-success-empty">
                  <StatusIcon status="ACTIVE" size={22} />
                  <div>
                    <strong>You&apos;re all caught up!</strong>
                    <p>
                      No students currently require follow-up based on the selected monitoring period and engagement
                      criteria.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="followup-empty-compact">
                  <strong>No matching enrolments</strong> for this filter.{" "}
                  <button type="button" className="text-btn" onClick={clearTableFilters}>
                    Clear table filters
                  </button>
                </p>
              )
            ) : (
              <>
                <div className={`table-card table-card-flush ${tableLoading ? "is-refreshing" : ""}`}>
                  <table className="data-table attention-table">
                    <thead>
                      <tr>
                        <th className="col-serial">S/N</th>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Course</th>
                        <th>Engagement score</th>
                        <th>Last Recorded Login</th>
                        <th>Classification</th>
                        <th className="students-col-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className={`row-status-${item.classification}`}>
                          <td data-label="S/N" className="col-serial">
                            {serialNumber(index, { page: tablePage, limit: TABLE_LIMIT })}
                          </td>
                          <td data-label="Student">
                            <span className="student-name">{item.student?.fullName}</span>
                          </td>
                          <td data-label="Student ID">
                            <span className="id-badge">{item.student?.matriculationNumber}</span>
                          </td>
                          <td data-label="Course">
                            <Link to={`/courses/${item.courseId}/overview`} {...returnToOverview} className="course-code">
                              {item.course?.code}
                            </Link>
                            <div className="course-name">{item.course?.name}</div>
                          </td>
                          <td data-label="Engagement score">{formatScore(item.displayScore)}</td>
                          <td data-label="Last Recorded Login">{formatLastRecordedActivity(item.lastActivityAt)}</td>
                          <td data-label="Classification">
                            <ClassificationBadge classification={item.classification} />
                          </td>
                          <td data-label="Action" className="students-col-action">
                            {studentDetailPath(item.student?.id) ? (
                              <Link
                                className="text-btn students-view-btn"
                                to={studentDetailPath(item.student.id, { courseId: item.courseId })}
                                {...returnToOverview}
                              >
                                View student →
                              </Link>
                            ) : (
                              <Link
                                className="text-btn students-view-btn"
                                to={`/courses/${item.courseId}/results/${item.id}`}
                                {...returnToOverview}
                              >
                                View evidence →
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tableTotalPages > 1 ? (
                  <div className="table-pager">
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={tablePage <= 1}
                      onClick={() => updateFilters({ tablePage: String(tablePage - 1) })}
                    >
                      Previous
                    </button>
                    <span className="muted">
                      Page {tablePage} of {tableTotalPages}
                    </span>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={tablePage >= tableTotalPages}
                      onClick={() => updateFilters({ tablePage: String(tablePage + 1) })}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {summary.state !== "no_classifications" ? (
            <CourseComparison
              items={comparison?.items || []}
              showComparison={comparison?.showComparison !== false && courseId === "all"}
              periodScope={summary.periodScope || periodScope}
              periodStart={period?.periodStart}
              periodEnd={period?.periodEnd}
            />
          ) : null}

          <DataFreshnessStrip summary={summary} />
        </>
      ) : null}
    </main>
  );
}