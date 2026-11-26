import { useEffect, useRef, useState } from "react";
import { useApiAction } from "../../hooks/useApiAction.js";
import { apiRequest } from "../../services/api.js";

function formatCourseContext(course) {
  if (!course) {
    return "";
  }
  return course.name ? `${course.code} · ${course.name}` : course.code;
}

export default function SendStudentMessageModal({
  open,
  onClose,
  student,
  lecturerEmail,
  courses = [],
  initialCourseId = "",
  onSent,
}) {
  const dialogRef = useRef(null);
  const run = useApiAction();
  const [courseId, setCourseId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setCourseId(initialCourseId || "");
    } else {
      setSubject("");
      setMessage("");
      setCourseId("");
      setError("");
      setSuccess("");
      setSaving(false);
    }
  }, [open, initialCourseId]);

  const canSend = Boolean(student?.email && lecturerEmail && subject.trim() && message.trim() && !saving);

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        subject: subject.trim(),
        message: message.trim(),
      };
      if (courseId) {
        body.courseId = courseId;
      }
      const sent = await run(
        async () => {
          const result = await apiRequest(`/api/v1/students/${student.id}/communications`, {
            method: "POST",
            body,
          });
          return result.data?.communication;
        },
        {
          success: "Message sent successfully.",
          rethrow: true,
        },
      );
      setSuccess("Message sent successfully.");
      onSent?.(sent.data);
      setTimeout(() => {
        onClose?.();
      }, 900);
    } catch (err) {
      if (err.payload?.communication) {
        onSent?.(err.payload.communication);
      }
      setError(err.message || "The message could not be sent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="student-modal student-modal--default" onClose={onClose}>
      <form className="student-modal-form" onSubmit={onSubmit}>
        <header className="student-modal-header">
          <h2>Send message</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="form-success" role="status">
            {success}
          </p>
        ) : null}
        <div className="message-compose-grid">
          <label htmlFor="msgFrom">From</label>
          <input
            id="msgFrom"
            type="email"
            value={lecturerEmail || ""}
            readOnly
            className="input-readonly"
            title="Replies go to your lecturer email (Reply-To)"
          />
          <label htmlFor="msgTo">To</label>
          <input
            id="msgTo"
            type="email"
            value={student?.email || ""}
            readOnly
            className="input-readonly"
            placeholder={student?.email ? undefined : "No email on file"}
          />
          <label htmlFor="msgCourse">Course</label>
          <select
            id="msgCourse"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            disabled={saving || courses.length === 0}
          >
            <option value="">No course context</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {formatCourseContext(course)}
              </option>
            ))}
          </select>
          <label htmlFor="msgSubject">Subject</label>
          <input
            id="msgSubject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            maxLength={200}
            disabled={saving}
          />
          <label htmlFor="msgBody">Message</label>
          <textarea
            id="msgBody"
            rows={8}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={20000}
            disabled={saving}
          />
        </div>
        {!student?.email ? (
          <p className="form-error" role="alert">
            Add a registered email for this student before sending a message.
          </p>
        ) : null}
        {!lecturerEmail ? (
          <p className="form-error" role="alert">
            Your lecturer account does not have an email address on file.
          </p>
        ) : null}
        <footer className="student-modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={!canSend}>
            {saving ? "Sending…" : "Send message"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}