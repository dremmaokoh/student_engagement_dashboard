import { useEffect, useRef, useState } from "react";
import { formatRunTitle } from "../../lib/classificationRuns.js";

export default function CourseGenerateClassificationModal({
  open,
  onClose,
  courseCode,
  courseName,
  periodStart,
  periodEnd,
  onGenerate,
  generating = false,
}) {
  const dialogRef = useRef(null);
  const [runName, setRunName] = useState("");
  const [error, setError] = useState("");

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
    if (!open) {
      setRunName("");
      setError("");
    }
  }, [open]);

  const trimmedName = runName.trim();
  const preview = formatRunTitle(courseCode, trimmedName || "…");

  function handleSubmit(event) {
    event.preventDefault();
    if (!trimmedName) {
      setError("Run name is required.");
      return;
    }
    setError("");
    onGenerate(trimmedName);
  }

  return (
    <dialog
      ref={dialogRef}
      className="student-modal student-modal--default course-workspace-modal"
      onClose={onClose}
    >
      <div className="student-modal-form course-workspace-modal-body">
        <header className="student-modal-header">
          <h2>Name This Classification Run</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <form className="stack-form classification-run-name-form" onSubmit={handleSubmit}>
          <label htmlFor="classificationRunCourse">Course</label>
          <input
            id="classificationRunCourse"
            type="text"
            readOnly
            value={courseCode ? `${courseCode}${courseName ? ` · ${courseName}` : ""}` : "—"}
          />

          <label htmlFor="classificationRunName">Run name</label>
          <input
            id="classificationRunName"
            type="text"
            value={runName}
            onChange={(event) => setRunName(event.target.value)}
            maxLength={120}
            placeholder="e.g. October Run"
            required
            autoFocus
          />

          <label>Monitoring period</label>
          <p className="classification-run-period-readonly panel-desc">
            {periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : "—"}
          </p>
          <p className="panel-desc">
            Based on the monitoring period linked to your latest confirmed activity import.
          </p>

          <div className="classification-run-name-preview" aria-live="polite">
            <span className="classification-run-name-preview-label">Preview</span>
            <strong>{preview}</strong>
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="course-workspace-modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={generating}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={generating || !trimmedName}>
              {generating ? "Generating…" : "Generate Run"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}