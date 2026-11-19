import IndicatorGlyph from "../dashboard/IndicatorGlyph.jsx";
import ClassificationBadge from "../design/ClassificationBadge.jsx";
import { LAST_RECORDED_LOGIN_LABEL } from "../../lib/classifications.js";
import { toPercentFraction } from "../../lib/weights.js";

export default function ConfigurationReadOnlyPanel({ config, globalWeights }) {
  const weights = config?.weights || globalWeights?.weights;
  if (!config || !weights) {
    return <p className="muted">Configuration not available.</p>;
  }

  return (
    <div className="settings-config-readonly">
      <section className="settings-config-block">
        <h3>Activity indicator weights (global)</h3>
        <p className="panel-desc">
          Applied to all courses. Version {globalWeights?.version ?? config.globalWeightsVersion ?? "—"}.
        </p>
        <ul className="settings-weight-list">
          <li>
            <IndicatorGlyph indicatorKey="lastActivity" /> {LAST_RECORDED_LOGIN_LABEL} — {toPercentFraction(weights.lastActivity)}%
          </li>
          <li>
            <IndicatorGlyph indicatorKey="materialAccess" /> Material access — {toPercentFraction(weights.materialAccess)}%
          </li>
          <li>
            <IndicatorGlyph indicatorKey="assignmentSubmission" /> Assignment submission —{" "}
            {toPercentFraction(weights.assignmentSubmission)}%
          </li>
        </ul>
      </section>

      <section className="settings-config-block">
        <h3>{LAST_RECORDED_LOGIN_LABEL} bands</h3>
        <p className="panel-desc">Course configuration v{config.version}. Days since last recorded login (UTC).</p>
        <table className="data-table settings-compact-table">
          <thead>
            <tr>
              <th>Min days</th>
              <th>Max days</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {config.lastActivityBands.map((band) => (
              <tr key={`${band.minDays}-${band.score}`}>
                <td>{band.minDays}</td>
                <td>{band.maxDays ?? "No limit"}</td>
                <td>{band.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="settings-config-block">
        <h3>Course material access</h3>
        <p className="panel-desc">
          Calculated automatically: (materials accessed ÷ materials available) × 100. Not Applicable when no materials
          were available.
        </p>
      </section>

      <section className="settings-config-block">
        <h3>Assignment submission</h3>
        <p className="panel-desc">
          Calculated automatically: (assignments submitted ÷ eligible assignments due) × 100. Not Applicable when none
          were due.
        </p>
      </section>

      <section className="settings-config-block">
        <h3>Final classification boundaries</h3>
        <table className="data-table settings-compact-table">
          <tbody>
            <tr>
              <th scope="row">
                <ClassificationBadge classification="ACTIVE" /> Active
              </th>
              <td>≥ {config.classificationBoundaries.activeMin}</td>
            </tr>
            <tr>
              <th scope="row">
                <ClassificationBadge classification="REQUIRING_ATTENTION" /> Requiring Attention
              </th>
              <td>
                {config.classificationBoundaries.requiringAttentionMin} –{" "}
                {(Number(config.classificationBoundaries.activeMin) - 0.01).toFixed(2)}
              </td>
            </tr>
            <tr>
              <th scope="row">
                <ClassificationBadge classification="INACTIVE" /> Inactive
              </th>
              <td>
                0 – {(Number(config.classificationBoundaries.requiringAttentionMin) - 0.01).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="panel-desc">
          Insufficient Data is returned when required indicator data is missing — it is not a score band.
        </p>
      </section>
    </div>
  );
}