import { classificationBadgeClass, classificationLabel } from "../../lib/classifications.js";
import StatusIcon from "./StatusIcon.jsx";

export default function ClassificationBadge({ classification }) {
  if (!classification) {
    return <span className="badge">—</span>;
  }
  return (
    <span className={`${classificationBadgeClass(classification)} badge-with-icon`}>
      <StatusIcon status={classification} size={14} />
      {classificationLabel(classification)}
    </span>
  );
}
