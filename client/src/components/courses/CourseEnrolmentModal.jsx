import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../services/api.js";

export default function CourseEnrolmentModal({ open, onClose, courseId, onEnrolled }) {
  const dialogRef = useRef(null);
  const [mode, setMode] = useState("existing");
  const [directory, setDirectory] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [enrolStudentId, setEnrolStudentId] = useState("");
  const [newName, setNewName] = useState("");
  const [newMatric, setNewMatric] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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
        const [studentsResult, enrolledResult] = await Promise.all([
          apiRequest("/api/v1/students?limit=200"),
          apiRequest(`/api/v1/courses/${courseId}/students?limit=500&page=1`),
        ]);
        if (cancelled) {
          return;
        }
        const ids = new Set(
          (enrolledResult.data.items || []).map((row) => row.student?.id || row.studentId).filter(Boolean),
        );
        setDirectory(studentsResult.data.items || []);
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
      setEnrolStudentId("");
      setNewName("");
      setNewMatric("");
      setNewEmail("");
      setError("");
    }
  }, [open]);

  const enrolableStudents = directory.filter((student) => !enrolledIds.has(student.id));

  async function onEnrolExisting(event) {
    event.preventDefault();
    if (!enrolStudentId) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/v1/courses/${courseId}/enrollments`, {
        method: "POST",
        body: { studentId: enrolStudentId },
      });
      onEnrolled?.();
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
      onEnrolled?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="student-modal course-workspace-modal" onClose={onClose}>
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
        {loading ? <p className="muted">Loading students…</p> : null}
        {!loading && mode === "existing" ? (
          <form className="stack-form" onSubmit={onEnrolExisting}>
            <label htmlFor="enrolStudentPick">Student</label>
            <select
              id="enrolStudentPick"
              value={enrolStudentId}
              onChange={(event) => setEnrolStudentId(event.target.value)}
              required
            >
              <option value="">Select student</option>
              {enrolableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName} ({student.matriculationNumber})
                </option>
              ))}
            </select>
            <button type="submit" className="primary-btn" disabled={saving || enrolableStudents.length === 0}>
              {saving ? "Saving…" : "Enrol student"}
            </button>
          </form>
        ) : null}
        {!loading && mode === "create" ? (
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
        ) : null}
      </div>
    </dialog>
  );
}