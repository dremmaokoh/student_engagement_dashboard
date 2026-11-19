import IndicatorGlyph from "../dashboard/IndicatorGlyph.jsx";
import ClassificationBadge from "./ClassificationBadge.jsx";
import IndicatorStatusBadge from "./IndicatorStatusBadge.jsx";

const CLASSIFICATIONS = ["ACTIVE", "REQUIRING_ATTENTION", "INACTIVE", "INSUFFICIENT_DATA"];
const INDICATORS = [
  { key: "lastActivity", label: "Last recorded LMS login/activity" },
  { key: "materialAccess", label: "Course material access" },
  { key: "assignmentSubmission", label: "Assignment submission" },
];

export default function DesignLegend() {
  return (
    <section className="card design-legend" aria-labelledby="design-legend-heading">
      <h2 id="design-legend-heading">Colour and status key</h2>
      <p className="lede">
        Brand blue is for navigation and primary actions; sunshine yellow appears only on small brand accents.
        Classification uses status colours. Indicators use blue, violet and teal. Labels are always shown with
        icons so colour is never the only signal.
      </p>

      <h3>Final classifications</h3>
      <ul className="legend-row">
        {CLASSIFICATIONS.map((status) => (
          <li key={status}>
            <ClassificationBadge classification={status} />
          </li>
        ))}
      </ul>

      <h3>Indicator categories</h3>
      <ul className="legend-row">
        {INDICATORS.map((indicator) => (
          <li key={indicator.key} className="legend-indicator">
            <IndicatorGlyph indicatorKey={indicator.key} />
            <span>{indicator.label}</span>
          </li>
        ))}
      </ul>

      <h3>Indicator states</h3>
      <ul className="legend-row">
        {INDICATORS.map((indicator) => (
          <li key={`${indicator.key}-calculated`} className="legend-indicator">
            <IndicatorGlyph indicatorKey={indicator.key} />
            <IndicatorStatusBadge status="CALCULATED" indicatorKey={indicator.key} />
          </li>
        ))}
        <li>
          <IndicatorStatusBadge status="NOT_APPLICABLE" />
        </li>
        <li>
          <IndicatorStatusBadge status="INSUFFICIENT_DATA" />
        </li>
      </ul>
    </section>
  );
}
