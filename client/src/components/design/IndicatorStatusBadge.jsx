import { statusLabel } from "../../lib/classifications.js";
import StatusIcon from "./StatusIcon.jsx";

export default function IndicatorStatusBadge({ status, indicatorKey }) {
  const className =
    status === "CALCULATED"
      ? `badge badge-with-icon badge-calculated glyph-${indicatorKey}`
      : status === "NOT_APPLICABLE"
        ? "badge badge-with-icon badge-na"
        : "badge badge-with-icon badge-insufficient";
  const iconStatus = status === "CALCULATED" ? "CALCULATED" : status;
  return (
    <span className={className}>
      <StatusIcon status={iconStatus} size={14} />
      {statusLabel(status)}
    </span>
  );
}
