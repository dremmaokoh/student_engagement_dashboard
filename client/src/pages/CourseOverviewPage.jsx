import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ContentSkeleton, {
  SkeletonChart,
  SkeletonPageHeader,
  SkeletonPanel,
  SkeletonSummaryGrid,
  SkeletonTable,
} from "../components/common/ContentSkeleton.jsx";
import ClassificationRunChanges from "../components/courses/ClassificationRunChanges.jsx";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import StudentsNeedingAttention from "../components/courses/StudentsNeedingAttention.jsx";
import ClassificationTrendChart from "../components/dashboard/ClassificationTrendChart.jsx";
import ClassificationTrendFilter from "../components/dashboard/ClassificationTrendFilter.jsx";
import DistributionChart from "../components/dashboard/DistributionChart.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import SummaryCard from "../components/design/SummaryCard.jsx";
import {
  assertAttentionDashboardsMatchRun,
  ATTENTION_CLASSIFICATIONS,
  attentionDashboardParams,
  attentionItemsFromDashboards,
  latestPeriodQuery,
} from "../lib/attentionItems.js";
import {
  courseMonitoringPath,
  courseOverviewPath,
  readCoursePeriod,
} from "../lib/coursePeriod.js";
import { formatCountDelta, runPeriodLabel } from "../lib/classificationRuns.js";
import { ALL_CLASSIFICATIONS } from "../lib/classificationTrend.js";
import { skeletonColumns } from "../lib/skeletonColumns.js";
import { apiRequest } from "../services/api.js";

function deltaHint(deltaText) {
  if (!deltaText) {
    return null;
  }
  return `vs previous run (${deltaText})`;
}

export default function CourseOverviewPage() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedPeriod = readCoursePeriod(searchParams);
  const [course, setCourse] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [classificationFilter, setClassificationFilter] = useState(ALL_CLASSIFICATIONS);
  const [enrolledCount, setEnrolledCount] = useState(null);
  const [attentionItems, setAttentionItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const latestRun = allRuns[0] || null;
  const previousRun = allRuns[1] || null;
  const latestCounts = latestRun?.counts || null;
  const latestPeriod = latestPeriodQuery(latestRun);

  const overviewPath = useMemo(() => {
    const period = latestPeriod || appliedPeriod;
    return courseOverviewPath(courseId, period);
  }, [courseId, latestPeriod, appliedPeriod]);

  async function load(isActive) {
    setLoading(true);
    setError("");
    setCourse(null);
    setAllRuns([]);
    setEnrolledCount(null);
    setAttentionItems([]);
    try {
      const [courseResult, runsResult] = await Promise.all([
        apiRequest(`/api/v1/courses/${courseId}`),
        apiRequest(`/api/v1/courses/${courseId}/classification-runs?scope=all`),
      ]);
      if (!isActive()) {
        return;
      }
      setCourse(courseResult.data.course);
      const items = runsResult.data.items || [];
      setAllRuns(items);

      const latest = items[0];
      if (!latest) {
        setEnrolledCount(null);
        setAttentionItems([]);
        return;
      }

      const period = latestPeriodQuery(latest);
      if (!period) {
        throw new Error("Latest classification run is missing monitoring period dates.");
      }

      const dashboards = await Promise.all(
        ATTENTION_CLASSIFICATIONS.map((classification) => {
          const params = attentionDashboardParams(period, latest.runId, classification);
          return apiRequest(`/api/v1/courses/${courseId}/dashboard?${params.toString()}`);
        }),
      );
      if (!isActive()) {
        return;
      }
      const dashboardData = dashboards.map((response) => response.data);
      assertAttentionDashboardsMatchRun(dashboardData, latest);
      setEnrolledCount(dashboardData[0]?.enrolledCount ?? null);
      setAttentionItems(attentionItemsFromDashboards(dashboardData));

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("periodStart", period.periodStart);
      nextParams.set("periodEnd", period.periodEnd);
      nextParams.set("runId", latest.runId);
      setSearchParams(nextParams, { replace: true });
    } catch (err) {
      if (!isActive()) {
        return;
      }
      setError(err.message);
      setAllRuns([]);
      setAttentionItems([]);
      setEnrolledCount(null);
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [courseId]);

  const hasRuns = allRuns.length > 0;

  return (
    <main className="content course-overview-page">
      <header className="content-header page-context-header course-overview-header">
        <BackLink fallbackTo="/courses" fallbackLabel="Back to Courses" />
        <Breadcrumbs
          items={[
            { label: "Overview", to: "/overview" },
            { label: "Courses", to: "/courses" },
            { label: course?.code || "Course" },
          ]}
        />
        {loading ? (
          <SkeletonPageHeader />
        ) : (
          <>
            <h1>
              {course?.code} · {course?.name}
            </h1>
            <p className="lede">
              {course?.description ||
                "Classification summary and trends from saved runs. Latest results are shown by default."}
            </p>
            {latestPeriod ? (
              <p className="panel-desc course-overview-latest-period">
                Latest classification monitoring period: {latestPeriod.periodStart} to {latestPeriod.periodEnd}.
                {previousRun ? " Summary cards compare with the previous run." : " Generate again to enable comparisons."}
              </p>
            ) : null}
          </>
        )}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <CourseTabs courseId={courseId} />

      <ContentSkeleton loading={loading} label="Loading course overview…">
        <SkeletonSummaryGrid className="status-grid course-overview-kpis" count={5} withDelta />
        <SkeletonPanel className="card course-overview-section" titleWidth="36%" showTitle lines={["64%"]}>
          <SkeletonChart />
        </SkeletonPanel>
        <SkeletonPanel className="card course-overview-section" titleWidth="32%" showTitle lines={["58%"]}>
          <SkeletonChart />
        </SkeletonPanel>
        <SkeletonPanel className="card course-overview-section" titleWidth="30%" showTitle lines={["70%", "52%"]} />
        <SkeletonPanel className="card course-overview-section course-overview-attention" titleWidth="42%" showTitle>
          <SkeletonTable
            columns={skeletonColumns("attention")}
            rows={4}
            tableClassName="students-directory-table course-overview-attention-table"
            wrapClassName="table-card students-table-wrap"
            showFooter
          />
        </SkeletonPanel>
      </ContentSkeleton>

      {!loading && !error && !hasRuns ? (
        <section className="card course-overview-section course-overview-empty-runs">
          <h2>No classifications yet</h2>
          <p className="lede">
            Import activity and generate classifications from the Monitoring tab. Historical runs and trends will appear
            here after your first successful generate.
          </p>
          <Link className="primary-btn" to={courseMonitoringPath(courseId)}>
            Go to Monitoring
          </Link>
        </section>
      ) : null}

      {!loading && hasRuns ? (
        <>
          <section className="status-grid course-overview-kpis" aria-label="Classification summary">
            <SummaryCard
              status="ENROLLED"
              label="Enrolled students"
              value={enrolledCount === null ? "—" : enrolledCount}
            />
            <SummaryCard
              status="ACTIVE"
              label="Active"
              value={!latestCounts ? "—" : latestCounts.ACTIVE}
              delta={
                previousRun && latestCounts
                  ? deltaHint(formatCountDelta(latestCounts.ACTIVE, previousRun.counts?.ACTIVE))
                  : null
              }
            />
            <SummaryCard
              status="REQUIRING_ATTENTION"
              label="Requiring Attention"
              value={!latestCounts ? "—" : latestCounts.REQUIRING_ATTENTION}
              delta={
                previousRun && latestCounts
                  ? deltaHint(formatCountDelta(latestCounts.REQUIRING_ATTENTION, previousRun.counts?.REQUIRING_ATTENTION))
                  : null
              }
            />
            <SummaryCard
              status="INACTIVE"
              label="Inactive"
              value={!latestCounts ? "—" : latestCounts.INACTIVE}
              delta={
                previousRun && latestCounts
                  ? deltaHint(formatCountDelta(latestCounts.INACTIVE, previousRun.counts?.INACTIVE))
                  : null
              }
            />
            <SummaryCard
              status="INSUFFICIENT_DATA"
              label="Insufficient Data"
              value={!latestCounts ? "—" : latestCounts.INSUFFICIENT_DATA}
              delta={
                previousRun && latestCounts
                  ? deltaHint(
                      formatCountDelta(latestCounts.INSUFFICIENT_DATA, previousRun.counts?.INSUFFICIENT_DATA),
                    )
                  : null
              }
            />
          </section>

          <section className="card course-overview-section">
            <h2>Classification distribution</h2>
            <p className="panel-desc">Latest classification run.</p>
            {latestCounts ? (
              <DistributionChart counts={latestCounts} showHeading />
            ) : (
              <p className="muted">No classification counts are available for this run.</p>
            )}
          </section>

          <section className="card course-overview-section">
            <div className="classification-trend-card-head">
              <div>
                <h2>Classification trend</h2>
                <p className="panel-desc">Historical counts from each saved classification run for this course.</p>
              </div>
              <ClassificationTrendFilter value={classificationFilter} onChange={setClassificationFilter} />
            </div>
            <ClassificationTrendChart
              runs={allRuns}
              loading={loading}
              latestRunId={latestRun?.runId}
              courseCode={course?.code}
              classificationFilter={classificationFilter}
            />
          </section>

          <ClassificationRunChanges latestRun={latestRun} previousRun={previousRun} loading={loading} />

          <StudentsNeedingAttention
            items={attentionItems}
            loading={loading}
            courseId={courseId}
            periodStart={latestPeriod?.periodStart}
            periodEnd={latestPeriod?.periodEnd}
            overviewPath={overviewPath}
          />
        </>
      ) : null}
    </main>
  );
}