import StatusIcon from "./StatusIcon.jsx";

const CARD_CLASS = {
  ENROLLED: "summary-enrolled",
  ACTIVE: "summary-active",
  REQUIRING_ATTENTION: "summary-attention",
  INACTIVE: "summary-inactive",
  INSUFFICIENT_DATA: "summary-insufficient",
};

export default function SummaryCard({ status, label, value, emphasis = false, selected = false, hint, delta }) {
  return (
    <article
      className={`summary-card ${CARD_CLASS[status] || ""} ${emphasis ? "summary-card-emphasis" : ""} ${selected ? "summary-card-selected" : ""}`}
    >
      <div className="summary-head">
        <span className={`summary-icon icon-${status}`}>
          <StatusIcon status={status} />
        </span>
        <p>
          {label}
          {hint ? (
            <span className="summary-hint" title={hint} aria-label={hint}>
              ?
            </span>
          ) : null}
        </p>
      </div>
      <strong>{value}</strong>
      {delta ? (
        <p className="summary-card-delta" title="Compared with the previous classification run">
          {delta}
        </p>
      ) : null}
    </article>
  );
}
