import { useEffect, useMemo, useRef, useState } from "react";
import { indicatorLabel } from "../../lib/classifications.js";
import { useApiAction } from "../../hooks/useApiAction.js";
import { apiRequest, downloadAuthenticated } from "../../services/api.js";

const TEMPLATE_FIELDS = [
  { key: "lastActivity", detail: "last learning activity date" },
  { key: "materialAccess", detail: "learning materials available and learning materials completed" },
  { key: "assignmentSubmission", detail: "assignments due and assignments submitted" },
];

function isValidRange(start, end) {
  if (!start || !end) {
    return false;
  }
  return new Date(end).getTime() >= new Date(start).getTime();
}

export default function CourseTemplateDownloadModal({
  open,
  onClose,
  courseId,
  courseCode,
  initialPeriodStart,
  initialPeriodEnd,
  onPeriodConfirmed,
}) {
  const run = useApiAction();
  const dialogRef = useRef(null);
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState(null);

  const rangeValid = useMemo(() => isValidRange(periodStart, periodEnd), [periodStart, periodEnd]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      node.showModal();
    }
    if (!open && node.open) {
      node.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setPeriodStart(initialPeriodStart);
      setPeriodEnd(initialPeriodEnd);
      setError("");
      setActiveIndicators(null);
    }
  }, [open, initialPeriodStart, initialPeriodEnd]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    apiRequest("/api/v1/settings/indicator-weights")
      .then((result) => {
        if (!cancelled) {
          setActiveIndicators(result.data?.weights?.activeIndicators || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveIndicators(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function onDownload(event) {
    event.preventDefault();
    if (!rangeValid) {
      setError("Period end cannot be earlier than period start.");
      return;
    }
    setDownloading(true);
    setError("");
    try {
      const params = new URLSearchParams({ periodStart, periodEnd });
      await run(
        () =>
          downloadAuthenticated(
            `/api/v1/courses/${courseId}/imports/template?${params.toString()}`,
            `${courseCode || "course"}-activity-import-template.csv`,
          ),
        { success: "Activity template downloaded.", rethrow: true },
      );
      onPeriodConfirmed?.({ periodStart, periodEnd });
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="student-modal student-modal--default course-workspace-modal"
      onClose={onClose}
    >
      <form className="student-modal-form course-workspace-modal-body" onSubmit={onDownload}>
        <header className="student-modal-header">
          <h2>Prepare Activity Template</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="panel-desc">
          Select the monitoring period for which you want to record student engagement activity. The file includes
          columns only for indicators that are currently active in Settings.
        </p>
        {activeIndicators ? (
          <ul className="panel-desc">
            {TEMPLATE_FIELDS.map((field) => {
              const included = activeIndicators[field.key] !== false;
              return (
                <li key={field.key}>
                  {indicatorLabel(field.key)}: {included ? field.detail : "excluded"}
                </li>
              );
            })}
          </ul>
        ) : null}
        {rangeValid ? (
          <p className="course-template-period-preview muted">
            Selected range: <strong>{periodStart}</strong> to <strong>{periodEnd}</strong>
          </p>
        ) : null}
        <label htmlFor="templatePeriodStart">Monitoring Period Start Date</label>
        <input
          id="templatePeriodStart"
          type="date"
          value={periodStart}
          onChange={(event) => setPeriodStart(event.target.value)}
          required
        />
        <label htmlFor="templatePeriodEnd">Monitoring Period End Date</label>
        <input
          id="templatePeriodEnd"
          type="date"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
          required
        />
        {!rangeValid && periodStart && periodEnd ? (
          <p className="form-error" role="alert">
            Period end cannot be earlier than period start.
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={downloading}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={downloading || !rangeValid}>
            {downloading ? "Preparing…" : "Download Template"}
          </button>
        </div>
      </form>
    </dialog>
  );
}