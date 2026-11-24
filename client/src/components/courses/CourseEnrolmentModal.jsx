import { useEffect, useMemo, useRef, useState } from "react";
import LoadingState from "../common/LoadingState.jsx";
import {
  filterEnrollableStudents,
  selectionStateForStudents,
  setStudentsSelected,
  toggleStudentSelection,
} from "../../lib/courseEnrolment.js";
import { apiRequest, downloadAuthenticated } from "../../services/api.js";

const STUDENT_PAGE_SIZE = 50;

/** The API caps pages at 50, so load every page rather than silently missing students. */
async function fetchAllPages(basePath) {
  const joiner = basePath.includes("?") ? "&" : "?";
  const first = await apiRequest(`${basePath}${joiner}limit=${STUDENT_PAGE_SIZE}&page=1`);
  const totalPages = Math.max(1, Number(first.data?.totalPages) || 1);
  const items = [...(first.data?.items || [])];

  if (totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        apiRequest(`${basePath}${joiner}limit=${STUDENT_PAGE_SIZE}&page=${index + 2}`),
      ),
    );
    for (const page of remainingPages) {
      items.push(...(page.data?.items || []));
    }
  }

  return items;
}

export default function CourseEnrolmentModal({ open, onClose, courseId, courseCode, onEnrolled }) {
  const dialogRef = useRef(null);
  const selectAllRef = useRef(null);
  const [mode, setMode] = useState("existing");
  const [directory, setDirectory] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newMatric, setNewMatric] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

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
    if (!open || !courseId) {
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [students, enrolled] = await Promise.all([
          fetchAllPages("/api/v1/students"),
          fetchAllPages(`/api/v1/courses/${courseId}/students`),
        ]);
        if (cancelled) {
          return;
        }
        const ids = new Set(
          (enrolled || []).map((row) => row.student?.id || row.studentId).filter(Boolean),
        );
        setDirectory(students || []);
        setEnrolledIds(ids);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, courseId]);

  useEffect(() => {
    if (!open) {
      setMode("existing");
      setSelectedIds(new Set());
      setStudentSearch("");
      setNewName("");
      setNewMatric("");
      setNewEmail("");
      setImportPreview(null);
      setImporting(false);
      setError("");
    }
  }, [open]);

  const enrolableStudents = useMemo(
    () => filterEnrollableStudents(directory, enrolledIds, ""),
    [directory, enrolledIds],
  );
  const visibleStudents = useMemo(
    () => filterEnrollableStudents(directory, enrolledIds, studentSearch),
    [directory, enrolledIds, studentSearch],
  );
  const visibleSelectionState = useMemo(
    () => selectionStateForStudents(selectedIds, visibleStudents),
    [selectedIds, visibleStudents],
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = visibleSelectionState === "some";
    }
  }, [visibleSelectionState]);

  async function onEnrolExisting(event) {
    event.preventDefault();
    const studentIds = [...selectedIds].filter((studentId) => !enrolledIds.has(studentId));
    if (studentIds.length === 0) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      // One bulk request instead of one request per selected student.
      const result = await apiRequest(`/api/v1/courses/${courseId}/enrollments/bulk`, {
        method: "POST",
        body: { studentIds },
      });
      onEnrolled?.(result.data.enrolled, 0);
      setSelectedIds(new Set());
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreateAndEnrol(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await apiRequest("/api/v1/students", {
        method: "POST",
        body: {
          fullName: newName,
          matriculationNumber: newMatric,
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
        },
      });
      await apiRequest(`/api/v1/courses/${courseId}/enrollments`, {
        method: "POST",
        body: { studentId: created.data.student.id },
      });
      onEnrolled?.(1, 0);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function downloadStudentTemplate() {
    setError("");
    try {
      const safeCode = String(courseCode || "course").replace(/[^\w.-]+/g, "_");
      await downloadAuthenticated(
        `/api/v1/courses/${courseId}/students/template`,
        `${safeCode}-students-template.csv`,
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function previewStudentImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setImporting(true);
    setError("");
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiRequest(`/api/v1/courses/${courseId}/students/import/preview`, {
        method: "POST",
        body: formData,
      });
      setImportPreview(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function confirmStudentImport() {
    if (!importPreview) {
      return;
    }
    setImporting(true);
    setError("");
    try {
      const result = await apiRequest(`/api/v1/courses/${courseId}/students/import/confirm`, {
        method: "POST",
        body: { importId: importPreview.importId },
      });
      setImportPreview(null);
      onEnrolled?.(result.data.counts.studentsCreated, 0);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function toggleSelectAll(event) {
    const checked = event.target.checked;
    setSelectedIds((previous) =>
      setStudentsSelected(
        previous,
        visibleStudents.map((student) => student.id),
        checked,
      ),
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="student-modal course-workspace-modal course-enrolment-modal"
      onClose={onClose}
    >
      <div className="student-modal-form course-workspace-modal-body">
        <header className="student-modal-header">
          <h2>Add students to course</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <div className="course-enrol-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === "existing" ? "course-students-chip is-selected" : "course-students-chip"}
            aria-selected={mode === "existing"}
            onClick={() => setMode("existing")}
          >
            Enrol existing
          </button>
          <button
            type="button"
            role="tab"
            className={mode === "create" ? "course-students-chip is-selected" : "course-students-chip"}
            aria-selected={mode === "create"}
            onClick={() => setMode("create")}
          >
            Create and enrol
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <LoadingState loading={loading} variant="inline" message="Loading student records…" />
        {!loading && mode === "existing" ? (
          <form className="stack-form" onSubmit={onEnrolExisting}>
            <div className="course-enrolment-picker-head">
              <label htmlFor="enrolStudentSearch">Search existing students</label>
              <span className="muted">{enrolableStudents.length} available to enrol</span>
            </div>
            <input
              id="enrolStudentSearch"
              className="course-enrolment-search-input"
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search name, student ID or email…"
            />
            <div className="course-enrolment-bulk-actions">
              <label className="course-enrolment-select-all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={visibleSelectionState === "all"}
                  onChange={toggleSelectAll}
                  disabled={visibleStudents.length === 0}
                />
                <span>
                  {studentSearch.trim() ? "Select all matching students" : "Select all available students"}
                </span>
              </label>
              <button
                type="button"
                className="text-btn"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0}
              >
                Clear selection
              </button>
            </div>
            <p className="course-enrolment-selection-summary" aria-live="polite">
              {selectedIds.size === 0
                ? "No students selected."
                : `${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"} selected.`}
            </p>
            <div className="course-enrolment-student-list" role="group" aria-label="Available students">
              {visibleStudents.length === 0 ? (
                <p className="muted">No available students match this search.</p>
              ) : (
                visibleStudents.map((student) => (
                  <label key={student.id} className="course-enrolment-student-option">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(student.id)}
                      onChange={() => setSelectedIds((previous) => toggleStudentSelection(previous, student.id))}
                    />
                    <span className="course-enrolment-student-details">
                      <span className="course-enrolment-student-name">{student.fullName}</span>
                      <span className="course-enrolment-student-meta">
                        {student.matriculationNumber || "No student ID"}
                        {student.email ? ` · ${student.email}` : ""}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="course-enrolment-form-actions course-workspace-modal-footer">
              <button
                type="submit"
                className="primary-btn"
                disabled={saving || selectedIds.size === 0}
              >
                {saving
                  ? "Enrolling…"
                  : selectedIds.size === 0
                    ? "Enrol selected students"
                    : `Enrol ${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        ) : null}
        {!loading && mode === "create" ? (
          <>
            <form className="stack-form" onSubmit={onCreateAndEnrol}>
              <label htmlFor="createEnrolName">Full name</label>
              <input
                id="createEnrolName"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                required
                minLength={2}
              />
              <label htmlFor="createEnrolMatric">Student ID</label>
              <input
                id="createEnrolMatric"
                value={newMatric}
                onChange={(event) => setNewMatric(event.target.value)}
                required
              />
              <label htmlFor="createEnrolEmail">Email (optional)</label>
              <input
                id="createEnrolEmail"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                autoComplete="email"
              />
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Saving…" : "Create and enrol"}
              </button>
            </form>
            <section className="course-enrolment-bulk" aria-labelledby="course-enrolment-bulk-heading">
              <h3 id="course-enrolment-bulk-heading">Import students from CSV</h3>
              <p className="panel-desc">
                Download the template and fill in <code>studentName</code>, <code>studentIdentifier</code> and{" "}
                <code>studentEmail</code>. Student IDs and emails must be unique in the file and must not already exist
                for any student, including previous course enrolments.
              </p>
              <div className="course-enrolment-bulk-actions-row">
                <button type="button" className="secondary-btn" onClick={downloadStudentTemplate}>
                  Download template
                </button>
                <label className="primary-btn file-btn">
                  {importing && !importPreview ? "Checking CSV…" : "Upload CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    disabled={importing}
                    onChange={previewStudentImport}
                  />
                </label>
              </div>
              {importPreview ? (
                <div className="course-enrolment-import-preview" role="status">
                  <p>
                    Preview: {importPreview.summary.validRows} valid · {importPreview.summary.invalidRows} invalid ·{" "}
                    {importPreview.summary.uniqueStudentIds} unique student IDs ·{" "}
                    {importPreview.summary.uniqueEmails} unique emails
                  </p>
                  {importPreview.validRows.length ? (
                    <ul className="course-enrolment-valid-list">
                      {importPreview.validRows.slice(0, 5).map((row) => (
                        <li key={row.rowNumber}>
                          {row.studentName} ({row.studentIdentifier}) · {row.studentEmail}
                        </li>
                      ))}
                      {importPreview.summary.validRows > importPreview.validRows.length ? (
                        <li className="muted">+{importPreview.summary.validRows - importPreview.validRows.length} more rows</li>
                      ) : null}
                    </ul>
                  ) : null}
                  {importPreview.invalidRows.length ? (
                    <ul className="course-enrolment-import-errors">
                      {importPreview.invalidRows.slice(0, 10).map((row) => (
                        <li key={row.rowNumber}>
                          Row {row.rowNumber}: {row.errors.join(" ")}
                        </li>
                      ))}
                      {importPreview.invalidRows.length > 10 ? (
                        <li className="muted">+{importPreview.invalidRows.length - 10} more errors</li>
                      ) : null}
                    </ul>
                  ) : null}
                  <div className="course-enrolment-import-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={!importPreview.summary.validRows || importing}
                      onClick={confirmStudentImport}
                    >
                      {importing
                        ? "Importing…"
                        : `Import ${importPreview.summary.validRows} student${importPreview.summary.validRows === 1 ? "" : "s"}`}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={importing}
                      onClick={() => setImportPreview(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
