import LoadingState from "../common/LoadingState.jsx";

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

export default function ActivityImportUsedPanel({ importUsed, hasRun, loading }) {
  return (
    <section className="card course-overview-provenance" aria-labelledby="activity-import-used-heading">
      <h2 id="activity-import-used-heading">Activity import used for current results</h2>
      <p className="panel-desc course-overview-provenance-lede">
        This activity dataset was used to generate the classification results currently displayed.
      </p>
      <LoadingState loading={loading} variant="inline" message="Loading import details…" />
      {!loading && !hasRun ? (
        <p className="course-overview-provenance-empty">
          No classification run for this monitoring period. Import activity and generate classifications to see data
          provenance.
        </p>
      ) : null}
      {!loading && hasRun && !importUsed ? (
        <p className="course-overview-provenance-empty">
          The current classification run has no linked activity import. Students without imported activity are shown as
          Insufficient Data.
        </p>
      ) : null}
      {!loading && importUsed ? (
        <dl className="activity-import-used-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <span className="activity-import-used-badge">Used for current results</span>
            </dd>
          </div>
          <div>
            <dt>File name</dt>
            <dd>{importUsed.filename}</dd>
          </div>
          <div>
            <dt>Import date</dt>
            <dd>{formatTimestamp(importUsed.confirmedAt || importUsed.createdAt)}</dd>
          </div>
          <div>
            <dt>Records imported</dt>
            <dd>{importUsed.importedCount ?? "—"}</dd>
          </div>
          <div>
            <dt>Records rejected</dt>
            <dd>{importUsed.rejectedCount ?? "—"}</dd>
          </div>
          <div>
            <dt>Records skipped</dt>
            <dd>{importUsed.skippedCount ?? "—"}</dd>
          </div>
        </dl>
      ) : null}
      {!loading && importUsed?.multipleImportSources ? (
        <p className="course-overview-provenance-note">
          Multiple activity imports contributed to this run. This file supplied activity for{" "}
          {importUsed.linkedStudentCount} of {importUsed.totalStudentsWithActivity} student
          {importUsed.totalStudentsWithActivity === 1 ? "" : "s"} with imported activity in the current results.
        </p>
      ) : null}
    </section>
  );
}