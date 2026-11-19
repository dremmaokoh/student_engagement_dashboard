import { useId } from "react";
import { classificationLabel } from "../../lib/classifications.js";
import useTableCellPopover from "./useTableCellPopover.js";

const VISIBLE_COURSE_ROWS = 3;

const STATUS_CLASS = {
  ACTIVE: "participation-status-label participation-active",
  REQUIRING_ATTENTION: "participation-status-label participation-attention",
  INACTIVE: "participation-status-label participation-inactive",
  INSUFFICIENT_DATA: "participation-status-label participation-insufficient",
  NOT_CLASSIFIED: "participation-status-label participation-neutral",
};

function courseClassificationLabel(classification) {
  if (!classification) {
    return "Not classified";
  }
  if (classification === "INSUFFICIENT_DATA") {
    return "Insufficient Data";
  }
  return classificationLabel(classification) || classification;
}

function CourseStatusLine({ row }) {
  const title = `${row.course.code} — ${row.course.name}`;
  const label = courseClassificationLabel(row.classification);
  const statusClass = row.classification
    ? STATUS_CLASS[row.classification] || STATUS_CLASS.NOT_CLASSIFIED
    : "participation-status-label participation-unclassified";

  return (
    <div className="course-status-line" title={title} role="listitem">
      <span className="course-status-code">{row.course.code}</span>
      <span className="course-status-dash" aria-hidden="true">
        —
      </span>
      <span className={statusClass}>{label}</span>
    </div>
  );
}

export default function StudentParticipationCell({ courseResults = [] }) {
  const { open, setOpen, rootRef, triggerRef } = useTableCellPopover();
  const popoverId = useId();

  const rows = [...courseResults].sort((left, right) =>
    String(left.course?.code || "").localeCompare(String(right.course?.code || "")),
  );

  if (!rows.length) {
    return <span className="muted participation-neutral">Not classified</span>;
  }

  const visibleRows = rows.slice(0, VISIBLE_COURSE_ROWS);
  const hiddenRows = rows.slice(VISIBLE_COURSE_ROWS);
  const hiddenCount = hiddenRows.length;

  return (
    <div className="participation-cell table-cell-popover-wrap" ref={rootRef}>
      <div className="participation-course-lines" role="list" aria-label="Participation by course">
        {visibleRows.map((row) => (
          <CourseStatusLine key={row.course.id} row={row} />
        ))}
      </div>

      {hiddenCount > 0 ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="participation-expand-trigger"
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={() => setOpen((current) => !current)}
          >
            +{hiddenCount} more
          </button>
          {open ? (
            <div
              className="table-cell-mini-popover table-cell-mini-popover-participation"
              id={popoverId}
              role="dialog"
              aria-label="Additional participation statuses"
            >
              <p className="table-cell-mini-popover-title">More courses</p>
              <div className="participation-course-lines" role="list">
                {hiddenRows.map((row) => (
                  <CourseStatusLine key={row.course.id} row={row} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}