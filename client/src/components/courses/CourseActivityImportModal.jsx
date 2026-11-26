import { useEffect, useRef, useState } from "react";
import { useApiAction } from "../../hooks/useApiAction.js";
import { displayImportValue, importCount, unwrapImportBatch } from "../../lib/importResponse.js";
import { apiRequest } from "../../services/api.js";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const PREVIEW_ROW_LIMIT = 20;

function validateSelectedFile(file) {
  if (!file) {
    return "Choose a CSV file to validate.";
  }
  if (!/\.csv$/i.test(file.name)) {
    return "Only .csv files are accepted.";
  }
  if (file.size === 0) {
    return "The selected CSV file is empty.";
  }
  if (file.size > MAX_CSV_BYTES) {
    return "CSV files must be 5MB or smaller.";
  }
  return "";
}

function formatImportDate(value) {
  const text = displayImportValue(value);
  if (text === "Missing") {
    return text;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

export default function CourseActivityImportModal({
  open,
  onClose,
  courseId,
  periodStart,
  periodEnd,
  onImportConfirmed,
}) {
  const run = useApiAction();
  const dialogRef = useRef(null);
  const openRef = useRef(open);
  const busyRef = useRef(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("idle");

  const working = phase === "validating" || phase === "confirming";

  useEffect(() => {
    openRef.current = open;
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
      setFileError("");
      setPreview(null);
      setError("");
      setPhase("idle");
    }
  }, [open]);

  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setFileError(validateSelectedFile(selected));
    setPreview(null);
    setError("");
    setPhase(selected ? "selected" : "idle");
  }

  async function previewFile(event) {
    event.preventDefault();
    const fileProblem = validateSelectedFile(file);
    if (fileProblem) {
      setFileError(fileProblem);
      return;
    }
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setError("");
    setPreview(null);
    setPhase("validating");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("monitoringPeriodStart", periodStart);
      formData.append("monitoringPeriodEnd", periodEnd);
      const response = await run(
        () =>
          apiRequest(`/api/v1/courses/${courseId}/imports/preview`, {
            method: "POST",
            formData,
          }),
        { rethrow: true },
      );
      const batch = unwrapImportBatch(response);
      if (!batch) {
        throw new Error("The validation response was incomplete. Please try again.");
      }
      if (!openRef.current) {
        return;
      }
      if (batch.status !== "previewed") {
        throw new Error("The CSV could not be prepared for import. Please try again.");
      }
      setPreview(batch);
      setPhase("validated");
    } catch (err) {
      if (openRef.current) {
        setError(err.message);
        setPhase("error");
      }
    } finally {
      busyRef.current = false;
    }
  }

  async function confirmPreview() {
    if (busyRef.current || preview?.status !== "previewed" || importCount(preview.validCount) < 1) {
      return;
    }

    busyRef.current = true;
    setError("");
    setPhase("confirming");

    try {
      const response = await run(
        () =>
          apiRequest(`/api/v1/courses/${courseId}/imports/confirm`, {
            method: "POST",
            body: { importId: preview.id },
          }),
        {
          loading: "Importing…",
          success: (result) =>
            `Activity import confirmed: ${importCount(result?.data?.importedCount)} imported, ${importCount(
              result?.data?.skippedCount,
            )} skipped.`,
          rethrow: true,
        },
      );
      const batch = unwrapImportBatch(response);
      if (!batch || batch.status !== "confirmed") {
        throw new Error("The import could not be confirmed. Please try again.");
      }
      if (!openRef.current) {
        return;
      }
      setPreview(batch);
      setPhase("confirmed");
      onImportConfirmed?.(batch);
    } catch (err) {
      if (openRef.current) {
        setError(err.message);
        setPhase("validated");
      }
    } finally {
      busyRef.current = false;
    }
  }

  const validCount = preview ? importCount(preview.validCount) : 0;
  const rejectedCount = preview ? importCount(preview.rejectedCount) : 0;
  const totalCount = preview
    ? importCount(preview.totalCount ?? validCount + rejectedCount)
    : 0;
  const duplicateCount = preview ? importCount(preview.duplicateCount) : 0;
  const importedCount = preview ? importCount(preview.importedCount) : 0;
  const skippedCount = preview ? importCount(preview.skippedCount) : 0;
  const validRows = Array.isArray(preview?.validRows) ? preview.validRows : [];
  const rejectedRows = Array.isArray(preview?.errors) ? preview.errors : [];
  const statusMessage =
    phase === "validating"
      ? "Reading and validating CSV…"
      : phase === "confirming"
        ? "Importing validated records…"
        : phase === "selected"
          ? "File selected. Choose Validate and preview."
          : phase === "idle"
            ? "Choose a CSV file to validate."
            : "";

  return (
    <dialog
      ref={dialogRef}
      className="student-modal student-modal--large course-workspace-modal course-activity-import-modal"
      onClose={onClose}
    >
      <div className="student-modal-form course-workspace-modal-body">
        <header className="student-modal-header">
          <h2>Import activity</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="panel-desc">
          Upload a synthetic activity CSV for enrolled students for {periodStart} to {periodEnd}. Record the most recent
          qualifying learning activity and LMS completion counts. Missing cells stay missing and are
          never stored as zero.
        </p>
        <form className="stack-form" onSubmit={previewFile}>
          <label htmlFor="importCsvFile">CSV file</label>
          <input
            id="importCsvFile"
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            onChange={handleFileChange}
            required
          />
          {statusMessage ? (
            <p className="muted" role="status">
              {statusMessage}
            </p>
          ) : null}
          {fileError || error ? (
            <p className="form-error" role="alert">
              {fileError || error}
            </p>
          ) : null}
          <button
            type="submit"
            className="secondary-btn"
            disabled={working || !file || Boolean(fileError)}
          >
            {phase === "validating" ? "Validating…" : "Validate and preview"}
          </button>
        </form>

        {preview ? (
          <div className="course-import-preview-summary">
            <h3>Validation summary</h3>
            <p>
              Total records processed: {totalCount}. Valid: {validCount}. Rejected: {rejectedCount}. Duplicates:{" "}
              {duplicateCount}.
            </p>

            {preview.status === "confirmed" ? (
              <p className="badge badge-session-ok" role="status">
                Import confirmed: {importedCount} imported, {skippedCount} skipped.
              </p>
            ) : null}

            {validRows.length ? (
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-serial">S/N</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Learning Activity Recency</th>
                      <th>Learning Materials Completed</th>
                      <th>Assignments Submitted</th>
                      <th>Validation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => (
                      <tr key={`${row.rowNumber}-${row.studentIdentifier}`}>
                        <td className="col-serial">{index + 1}</td>
                        <td>{displayImportValue(row.studentIdentifier)}</td>
                        <td>{displayImportValue(row.studentName)}</td>
                        <td>{formatImportDate(row.lastLearningActivityAt || row.lastActivityAt)}</td>
                        <td>{displayImportValue(row.learningItemsCompleted ?? row.materialsAccessed)}</td>
                        <td>{displayImportValue(row.assignmentsSubmitted)}</td>
                        <td>Valid</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > PREVIEW_ROW_LIMIT ? (
                  <p className="muted">Showing first {PREVIEW_ROW_LIMIT} valid records.</p>
                ) : null}
              </div>
            ) : null}

            {rejectedRows.length ? (
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-serial">S/N</th>
                      <th>Row</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Field</th>
                      <th>Reason</th>
                      <th>Validation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedRows.slice(0, PREVIEW_ROW_LIMIT).map((item, index) => (
                      <tr key={`${item.rowNumber}-${item.field}-${index}`}>
                        <td className="col-serial">{index + 1}</td>
                        <td>{item.rowNumber}</td>
                        <td>{displayImportValue(item.studentIdentifier)}</td>
                        <td>{displayImportValue(item.studentName)}</td>
                        <td>{displayImportValue(item.field)}</td>
                        <td>{item.reason || "This row could not be validated."}</td>
                        <td>Rejected</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rejectedRows.length > PREVIEW_ROW_LIMIT ? (
                  <p className="muted">Showing first {PREVIEW_ROW_LIMIT} validation errors.</p>
                ) : null}
              </div>
            ) : null}

            {preview.status === "previewed" ? (
              <div className="course-monitoring-modal-actions">
                {validCount > 0 ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={confirmPreview}
                    disabled={working}
                  >
                    {phase === "confirming" ? "Importing…" : "Confirm import"}
                  </button>
                ) : (
                  <p className="muted">All records were rejected. No import is available.</p>
                )}
                {preview.status === "previewed" && rejectedCount > 0 && validCount > 0 ? (
                  <p className="muted">
                    Only {validCount} valid record{validCount === 1 ? "" : "s"} will be imported.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
