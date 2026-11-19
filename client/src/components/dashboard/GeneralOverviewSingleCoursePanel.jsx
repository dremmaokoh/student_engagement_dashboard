import { Link } from "react-router-dom";
import ClassificationTrendChart from "./ClassificationTrendChart.jsx";
import DistributionChart from "./DistributionChart.jsx";
import SummaryCard from "../design/SummaryCard.jsx";
import { formatCountDelta } from "../../lib/classificationRuns.js";
import { courseMonitoringPath, courseOverviewPath } from "../../lib/coursePeriod.js";

function deltaHint(deltaText) {
  if (!deltaText) {
    return null;
  }
  return `vs previous run (${deltaText})`;
}

export default function GeneralOverviewSingleCoursePanel({
  course,
  period,
  periodScope = "latest",
  summary,
  runs,
  runsLoading,
}) {
  const latestRun = runs[0] || null;
  const previousRun = runs[1] || null;
  const latestCounts = latestRun?.counts || summary?.counts || null;
  const linkPeriod = {
    periodStart:
      period?.periodStart ??
      summary?.period?.monitoringPeriodStart ??
      latestRun?.monitoringPeriodStart ??
      undefined,
    periodEnd:
      period?.periodEnd ?? summary?.period?.monitoringPeriodEnd ?? latestRun?.monitoringPeriodEnd ?? undefined,
  };

  return (
    <section className="dashboard-single-course-panel" aria-label="Course detail overview">
      <div className="dashboard-single-course-head">
        <h2 className="panel-title">
          {course?.code} · {course?.name}
        </h2>
        <p className="panel-desc">
          {periodScope === "latest"
            ? "Latest classification run for this course (same view as course overview)."
            : "Same latest-run view as the course overview for the selected monitoring period."}
        </p>
        <div className="dashboard-single-course-links">
          <Link className="secondary-btn" to={courseOverviewPath(course?.id, linkPeriod)}>
            Open full course overview
          </Link>
          <Link className="text-btn" to={courseMonitoringPath(course?.id, linkPeriod)}>
            Monitoring →
          </Link>
        </div>
      </div>

      {latestCounts ? (
        <div className="status-grid course-overview-kpis dashboard-kpi-compact">
          <SummaryCard status="ENROLLED" label="Enrolled students" value={summary?.enrolledCount ?? "—"} />
          <SummaryCard
            status="ACTIVE"
            label="Active"
            value={latestCounts.ACTIVE}
            delta={
              previousRun && latestCounts
                ? deltaHint(formatCountDelta(latestCounts.ACTIVE, previousRun.counts?.ACTIVE))
                : null
            }
          />
          <SummaryCard
            status="REQUIRING_ATTENTION"
            label="Requiring Attention"
            value={latestCounts.REQUIRING_ATTENTION}
            delta={
              previousRun && latestCounts
                ? deltaHint(
                    formatCountDelta(latestCounts.REQUIRING_ATTENTION, previousRun.counts?.REQUIRING_ATTENTION),
                  )
                : null
            }
          />
          <SummaryCard
            status="INACTIVE"
            label="Inactive"
            value={latestCounts.INACTIVE}
            delta={
              previousRun && latestCounts
                ? deltaHint(formatCountDelta(latestCounts.INACTIVE, previousRun.counts?.INACTIVE))
                : null
            }
          />
          <SummaryCard
            status="INSUFFICIENT_DATA"
            label="Insufficient Data"
            value={latestCounts.INSUFFICIENT_DATA}
            delta={
              previousRun && latestCounts
                ? deltaHint(formatCountDelta(latestCounts.INSUFFICIENT_DATA, previousRun.counts?.INSUFFICIENT_DATA))
                : null
            }
          />
        </div>
      ) : null}

      <section className="card course-overview-section">
        <h3>Classification distribution</h3>
        <DistributionChart counts={latestCounts || summary?.counts} showHeading />
      </section>

      <section className="card course-overview-section">
        <h3>Classification trend</h3>
        <ClassificationTrendChart runs={runs} loading={runsLoading} latestRunId={latestRun?.runId} courseCode={course?.code} />
      </section>
    </section>
  );
}