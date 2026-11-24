import LoadingState from "../common/LoadingState.jsx";
import { buildChangesSincePreviousCopy } from "../../lib/classificationRuns.js";

export default function ClassificationRunChanges({ latestRun, previousRun, loading }) {
  if (loading) {
    return (
      <section className="card course-overview-section course-overview-changes" aria-labelledby="changes-heading">
        <h2 id="changes-heading">Changes since previous classification</h2>
        <LoadingState loading variant="inline" message="Preparing run comparison…" />
      </section>
    );
  }

  if (!latestRun || !previousRun) {
    return null;
  }

  const lines = buildChangesSincePreviousCopy(latestRun, previousRun);
  if (!lines.length) {
    return null;
  }

  return (
    <section className="card course-overview-section course-overview-changes" aria-labelledby="changes-heading">
      <h2 id="changes-heading">Changes since previous classification</h2>
      <p className="panel-desc">Aggregate differences between your latest run and the prior saved run (not individual students).</p>
      <ul className="course-overview-changes-list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}