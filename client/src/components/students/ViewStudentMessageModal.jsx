import { useEffect, useRef } from "react";

function dateTimeLabel(value) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  if (status === "sent") {
    return "Sent";
  }
  if (status === "not_configured") {
    return "Not sent — mail not configured";
  }
  return "Failed";
}

export default function ViewStudentMessageModal({ open, message, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }
    if (open && message && !node.open) {
      node.showModal();
    }
    if ((!open || !message) && node.open) {
      node.close();
    }
  }, [open, message]);

  if (!message) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="student-modal student-modal--default student-view-message-modal"
      onClose={onClose}
    >
      <div className="student-modal-form">
        <header className="student-modal-header">
          <h2>Message details</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <dl className="view-message-dl">
          <div>
            <dt>Sent</dt>
            <dd>{dateTimeLabel(message.sentAt)}</dd>
          </div>
          <div>
            <dt>Subject</dt>
            <dd>{message.subject}</dd>
          </div>
          <div>
            <dt>Course</dt>
            <dd>
              {message.course ? (
                <>
                  <span className="course-code">{message.course.code}</span>
                  {message.course.name ? <span className="muted"> · {message.course.name}</span> : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`comm-status comm-status-${message.status}`}>{statusLabel(message.status)}</span>
            </dd>
          </div>
          <div>
            <dt>To</dt>
            <dd>{message.toEmail}</dd>
          </div>
          <div>
            <dt>Reply-To</dt>
            <dd>{message.replyToEmail}</dd>
          </div>
        </dl>
        <div className="view-message-body">
          <h3 className="view-message-body-label">Message</h3>
          <p className="view-message-text">{message.bodyText}</p>
          {message.errorMessage && message.status !== "sent" ? (
            <p className="student-communication-error form-error" role="alert">
              {message.errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}