export default function ClassificationCoverageCard({ summary }) {
  if (!summary || summary.enrolledCount == null) {
    return null;
  }

  const enrolled = summary.enrolledCount ?? 0;
  const classified = summary.classifiedCount ?? 0;
  const unclassified = summary.unclassifiedEnrolments ?? Math.max(0, enrolled - classified);
  const coverage = summary.classificationCoveragePercent;

  return (
    <section className="card dashboard-panel classification-coverage-card" aria-labelledby="coverage-heading">
      <h2 id="coverage-heading" className="panel-title">
        Classification coverage
      </h2>
      <p className="panel-desc">
        Counts are course enrolments in scope for the selected monitoring period, not unique students.
      </p>
      <dl className="classification-coverage-dl">
        <div>
          <dt>Total course enrolments</dt>
          <dd>{enrolled}</dd>
        </div>
        <div>
          <dt>Classified enrolments</dt>
          <dd>{classified}</dd>
        </div>
        <div>
          <dt>Not yet classified</dt>
          <dd>{unclassified}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{coverage != null ? `${coverage}%` : "—"}</dd>
        </div>
      </dl>
      {unclassified > 0 ? (
        <p className="panel-desc classification-coverage-note">
          Not yet classified enrolments are enrolments without a saved classification run for this period. They are not
          counted as Insufficient Data.
        </p>
      ) : null}
    </section>
  );
}