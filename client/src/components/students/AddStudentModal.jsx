import { useEffect, useRef } from "react";

export default function AddStudentModal({
  open,
  onClose,
  courses,
  fullName,
  matriculationNumber,
  email,
  courseId,
  onChange,
  onSubmit,
  saving,
  error,
}) {
  const dialogRef = useRef(null);

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

  return (
    <dialog ref={dialogRef} className="student-modal" onClose={onClose}>
      <form className="student-modal-form" onSubmit={onSubmit}>
        <header className="student-modal-header">
          <h2>Add student</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="panel-desc">
          For bulk setup, import course and enrolment CSV from Courses. Use this form for an individual student.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <label htmlFor="modalStudentName">Full name</label>
        <input
          id="modalStudentName"
          value={fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          required
          minLength={2}
          autoComplete="name"
        />
        <label htmlFor="modalStudentMatric">Student ID</label>
        <input
          id="modalStudentMatric"
          value={matriculationNumber}
          onChange={(event) => onChange({ matriculationNumber: event.target.value })}
          required
        />
        <label htmlFor="modalStudentEmail">Email (optional)</label>
        <input
          id="modalStudentEmail"
          type="email"
          value={email}
          onChange={(event) => onChange({ email: event.target.value })}
          autoComplete="email"
        />
        <label htmlFor="modalStudentCourse">Course</label>
        <select
          id="modalStudentCourse"
          value={courseId}
          onChange={(event) => onChange({ courseId: event.target.value })}
          required
        >
          <option value="">Select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} · {course.name}
            </option>
          ))}
        </select>
        {courses.length === 0 ? (
          <p className="form-error">Create a course first before enrolling students.</p>
        ) : null}
        <p className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={saving || courses.length === 0}>
            {saving ? "Saving…" : "Create and enrol"}
          </button>
        </p>
      </form>
    </dialog>
  );
}