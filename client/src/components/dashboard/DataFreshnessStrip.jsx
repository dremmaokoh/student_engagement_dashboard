function dateTimeLabel(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 10);
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateFilename(name, max = 36) {
  if (!name || name.length <= max) {
    return name || "";
  }
  return `${name.slice(0, max - 1)}…`;
}

export default function DataFreshnessStrip({ summary }) {
  if (!summary) {
    return null;
  }

  const { latestImport, coursesWithRuns, courseCount, classifiedCount, enrolledCount, classificationCoveragePercent } =
    summary;

  return (
    <footer className="card dashboard-panel data-freshness-strip" aria-label="Data update and coverage">
      <h2 className="panel-title">Data update</h2>
      <dl className="data-freshness-dl">
        <div>
          <dt>Most recent activity import</dt>
          <dd>
            {latestImport ? (
              <>
                {dateTimeLabel(latestImport.confirmedAt || latestImport.createdAt)} · {latestImport.course?.code || "—"}
                {latestImport.course?.name ? ` (${latestImport.course.name})` : ""}
              </>
            ) : (
              "No confirmed import in scope for this period"
            )}
          </dd>
        </div>
        {latestImport ? (
          <>
            <div>
              <dt>Records imported</dt>
              <dd>{latestImport.importedCount ?? 0}</dd>
            </div>
            <div>
              <dt>Records rejected</dt>
              <dd>{latestImport.rejectedCount ?? 0}</dd>
            </div>
            <div>
              <dt>Records skipped</dt>
              <dd>{latestImport.skippedCount ?? 0}</dd>
            </div>
            <div>
              <dt>Import file</dt>
              <dd title={latestImport.filename}>{truncateFilename(latestImport.filename)}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>Courses analysed</dt>
          <dd>
            {coursesWithRuns ?? 0} of {courseCount ?? 0}
          </dd>
        </div>
        <div>
          <dt>Overall classification coverage</dt>
          <dd>
            {classifiedCount ?? 0} / {enrolledCount ?? 0} enrolments
            {classificationCoveragePercent != null ? ` (${classificationCoveragePercent}%)` : ""}
          </dd>
        </div>
      </dl>
    </footer>
  );
}