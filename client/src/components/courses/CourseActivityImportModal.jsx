import { useEffect, useRef, useState } from "react";
import { apiRequest, downloadAuthenticated } from "../../services/api.js";

export default function CourseActivityImportModal({
  open,
  onClose,
  courseId,
  courseCode,
  periodStart,
  periodEnd,
  onImportConfirmed,
}) {
  const dialogRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

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
      setFile(null);
      setPreview(null);
      setError("");
    }
  }, [open]);

  async function downloadTemplate() {
    setError("");
    try {
      const params = new URLSearchParams({ periodStart, periodEnd });
      await downloadAuthenticated(
        `/api/v1/courses/${courseId}/imports/template?${params.toString()}`,
        `${courseCode || "course"}-activity-import-template.csv`,
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function previewFile(event) {
    event.preventDefault();
    if (!file) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("monitoringPeriodStart", periodStart);
      formData.append("monitoringPeriodEnd", periodEnd);
      const result = await apiRequest(`/api/v1/courses/${courseId}/imports/preview`, {
        method: "POST",
        formData,
      });
      setPreview(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function confirmPreview() {
    if (!preview?.id) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const result = await apiRequest(`/api/v1/courses/${courseId}/imports/confirm`, {
        method: "POST",
        body: { importId: preview.id },
      });
      setPreview(result.data);
      onImportConfirmed?.(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="student-modal course-workspace-modal" onClose={onClose}>
      <div className="student-modal-form course-workspace-modal-body">
        <header className="student-modal-header">
          <h2>Import activity</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="panel-desc">
          Upload LMS activity for enrolled students for {periodStart} to {periodEnd}. Missing cells stay missing and are
          never stored as zero.
        </p>
        <div className="course-monitoring-modal-actions">
          <button type="button" className="secondary-btn" onClick={downloadTemplate}>
            Download template
          </button>
        </div>
        <form className="stack-form" onSubmit={previewFile}>
          <label htmlFor="importCsvFile">CSV file</label>
          <input
            id="importCsvFile"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="secondary-btn" disabled={working || !file}>
            {working ? "Validating…" : "Validate and preview"}
          </button>
        </form>

        {preview ? (
          <div className="course-import-preview-summary">
            <h3>Preview</h3>
            <p>
              Valid: {preview.validCount}. Rejected: {preview.rejectedCount}.
              {preview.status === "confirmed"
                ? ` Imported: ${preview.importedCount}. Skipped: ${preview.skippedCount}.`
                : null}
            </p>
            {preview.errors?.length ? (
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Field</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.slice(0, 20).map((item) => (
                      <tr key={`${item.rowNumber}-${item.field}`}>
                        <td>{item.rowNumber}</td>
                        <td>{item.field}</td>
                        <td>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.errors.length > 20 ? (
                  <p className="muted">Showing first 20 validation errors.</p>
                ) : null}
              </div>
            ) : null}
            {preview.status === "previewed" ? (
              <button type="button" className="primary-btn" onClick={confirmPreview} disabled={working}>
                Confirm import
              </button>
            ) : (
              <p className="badge badge-session-ok">Import confirmed</p>
            )}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}