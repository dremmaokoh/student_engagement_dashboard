import IndicatorGlyph from "../dashboard/IndicatorGlyph.jsx";
import ClassificationBadge from "../design/ClassificationBadge.jsx";
import { indicatorLabel } from "../../lib/classifications.js";
import { toPercentFraction } from "../../lib/weights.js";

function weightLine(key, weights, activeIndicators) {
  if (activeIndicators?.[key] === false) {
    return `${indicatorLabel(key)} — Excluded`;
  }
  return `${indicatorLabel(key)} — ${toPercentFraction(weights[key])}%`;
}

export default function ConfigurationReadOnlyPanel({ config, globalWeights }) {
  const weights = config?.weights || globalWeights?.weights;
  const activeIndicators = globalWeights?.activeIndicators || config?.activeIndicators;
  if (!config || !weights) {
    return <p className="muted">Configuration not available.</p>;
  }

  return (
    <div className="settings-config-readonly">
      <section className="settings-config-block">
        <h3>Activity indicator weights (global)</h3>
        <p className="panel-desc">
          Applied to all courses. Version {globalWeights?.version ?? config.globalWeightsVersion ?? "—"}. Excluded
          indicators are not scored.
        </p>
        <ul className="settings-weight-list">
          {["lastActivity", "materialAccess", "assignmentSubmission"].map((key) => (
            <li key={key}>
              <IndicatorGlyph indicatorKey={key} /> {weightLine(key, weights, activeIndicators)}
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-config-block">
        <h3>{indicatorLabel("lastActivity")} bands</h3>
        <p className="panel-desc">Course configuration v{config.version}. Days since the most recent qualifying learning activity (UTC).</p>
        <table className="data-table settings-compact-table">
          <thead>
            <tr>
              <th className="col-serial">S/N</th>
              <th>Min days</th>
              <th>Max days</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {config.lastActivityBands.map((band, index) => (
              <tr key={`${band.minDays}-${band.score}`}>
                <td className="col-serial">{index + 1}</td>
                <td>{band.minDays}</td>
                <td>{band.maxDays ?? "No limit"}</td>
                <td>{band.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="settings-config-block">
        <h3>{indicatorLabel("materialAccess")}</h3>
        <p className="panel-desc">
          Calculated automatically: (learning items completed ÷ learning items required) × 100. Not Applicable when no learning items
          were required.
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
          <thead>
            <tr>
              <th className="col-serial">S/N</th>
              <th>Classification</th>
              <th>Score range</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="col-serial">1</td>
              <th scope="row">
                <ClassificationBadge classification="ACTIVE" /> Active
              </th>
              <td>≥ {config.classificationBoundaries.activeMin}</td>
            </tr>
            <tr>
              <td className="col-serial">2</td>
              <th scope="row">
                <ClassificationBadge classification="REQUIRING_ATTENTION" /> Requiring Attention
              </th>
              <td>
                {config.classificationBoundaries.requiringAttentionMin} –{" "}
                {(Number(config.classificationBoundaries.activeMin) - 0.01).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="col-serial">3</td>
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