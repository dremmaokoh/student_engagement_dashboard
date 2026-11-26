import { INDICATOR_HELP } from "../../lib/classifications.js";

export default function IndicatorInfo({ indicatorKey }) {
  const help = INDICATOR_HELP[indicatorKey];
  if (!help) {
    return null;
  }
  return (
    <span className="summary-hint" title={help} aria-label={help} role="img">
      i
    </span>
  );
}