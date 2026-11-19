import { useId } from "react";
import useTableCellPopover from "./useTableCellPopover.js";

const DEFAULT_VISIBLE = 3;

export default function StudentCourseBadges({ courses = [], maxVisible = DEFAULT_VISIBLE }) {
  const { open, setOpen, rootRef, triggerRef } = useTableCellPopover();
  const popoverId = useId();

  if (!courses.length) {
    return <span className="muted">—</span>;
  }

  const sorted = [...courses].sort((left, right) =>
    String(left.code || "").localeCompare(String(right.code || "")),
  );
  const visible = sorted.slice(0, maxVisible);
  const hidden = sorted.slice(maxVisible);
  const remaining = hidden.length;

  return (
    <div className="table-cell-popover-wrap course-badge-row" ref={rootRef}>
      {visible.map((course) => (
        <span key={course.id} className="course-badge" title={`${course.code} · ${course.name}`}>
          {course.code}
        </span>
      ))}
      {remaining > 0 ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="course-badge course-badge-more course-badge-more-btn"
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={() => setOpen((current) => !current)}
          >
            +{remaining} more
          </button>
          {open ? (
            <div className="table-cell-mini-popover" id={popoverId} role="dialog" aria-label="Additional courses">
              <p className="table-cell-mini-popover-title">More courses</p>
              <ul className="table-cell-mini-popover-list">
                {hidden.map((course) => (
                  <li key={course.id} className="table-cell-mini-popover-item">
                    <span className="course-status-code">{course.code}</span>
                    <span className="muted table-cell-mini-popover-sub">{course.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}