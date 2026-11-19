function dateLabel(value) {
  if (!value) {
    return "—";
  }
  return String(value).slice(0, 10);
}

export default function DataFreshnessPanel({ summary }) {
  if (!summary) {
    return null;
  }

  const { latestImport, coursesWithRuns, courseCount } = summary;

  return (
    <section className="card dashboard-panel dashboard-freshness" aria-labelledby="data-freshness-heading">
      <h2 id="data-freshness-heading">Data freshness</h2>
      <p className="panel-desc">Import and classification coverage for the current filter selection.</p>
      <dl className="data-freshness-grid">
        <div className="data-freshness-item">
          <dt>Classification runs</dt>
          <dd>
            {coursesWithRuns} of {courseCount} courses in this period
          </dd>
        </div>
        {latestImport ? (
          <>
            <div className="data-freshness-item">
              <dt>Latest import</dt>
              <dd>{dateLabel(latestImport.confirmedAt)}</dd>
            </div>
            <div className="data-freshness-item">
              <dt>File</dt>
              <dd title={latestImport.filename}>{latestImport.filename}</dd>
            </div>
            <div className="data-freshness-item">
              <dt>Course</dt>
              <dd>{latestImport.course?.code || "—"}</dd>
            </div>
            <div className="data-freshness-item">
              <dt>Import summary</dt>
              <dd>
                {latestImport.importedCount} imported · {latestImport.rejectedCount} rejected ·{" "}
                {latestImport.skippedCount} skipped
              </dd>
            </div>
          </>
        ) : (
          <div className="data-freshness-item data-freshness-wide">
            <dt>Activity imports</dt>
            <dd>No confirmed activity imports for this selection yet.</dd>
          </div>
        )}
      </dl>
    </section>
  );
}