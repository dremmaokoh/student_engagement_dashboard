import ContentSkeleton, { SkeletonBar } from "../common/ContentSkeleton.jsx";

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LatestImportSummary({ latestImport, loading }) {
  return (
    <section className="card course-monitoring-import-summary" aria-labelledby="latest-import-heading">
      <div className="course-monitoring-import-summary-head">
        <h2 id="latest-import-heading">Latest activity import</h2>
        <p className="panel-desc course-monitoring-import-period">
          Informational summary of the most recent confirmed import for this course. It does not lock the monitoring
          period — prepare another template and import when you need a different period.
        </p>
      </div>
      <ContentSkeleton loading={loading} label="Loading import details…">
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
      </ContentSkeleton>
      {!loading && !latestImport ? (
        <p className="course-monitoring-import-empty">
          No confirmed activity import yet. Download an activity template, add activity data, then import the file.
        </p>
      ) : null}
      {!loading && latestImport ? (
        <dl className="activity-import-used-dl course-monitoring-import-dl course-monitoring-import-dl-compact">
          <div>
            <dt>Monitoring period</dt>
            <dd>
              {latestImport.monitoringPeriodStart || "—"} to {latestImport.monitoringPeriodEnd || "—"}
            </dd>
          </div>
          <div>
            <dt>File name</dt>
            <dd>{latestImport.filename}</dd>
          </div>
          <div>
            <dt>Import date</dt>
            <dd>{formatTimestamp(latestImport.confirmedAt)}</dd>
          </div>
          <div>
            <dt>Imported</dt>
            <dd>{latestImport.importedCount ?? "—"}</dd>
          </div>
          <div>
            <dt>Rejected</dt>
            <dd>{latestImport.rejectedCount ?? "—"}</dd>
          </div>
          <div>
            <dt>Skipped</dt>
            <dd>{latestImport.skippedCount ?? "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="badge badge-session-ok">Confirmed</span>
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}