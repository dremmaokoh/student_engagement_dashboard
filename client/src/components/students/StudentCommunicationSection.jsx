import { useState } from "react";
import ViewStudentMessageModal from "./ViewStudentMessageModal.jsx";

function statusLabel(status) {
  if (status === "sent") {
    return "Sent";
  }
  if (status === "not_configured") {
    return "Not sent";
  }
  return "Failed";
}

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

export default function StudentCommunicationSection({ communications, loading, onSendClick }) {
  const [viewing, setViewing] = useState(null);

  return (
    <section className="card student-communication-panel" aria-labelledby="student-communication-heading">
      <div className="student-communication-head">
        <h2 id="student-communication-heading">Student communication</h2>
        <button type="button" className="primary-btn" onClick={onSendClick}>
          Send message
        </button>
      </div>
      {loading ? (
        <p className="muted" role="status">
          Loading message history…
        </p>
      ) : communications?.length ? (
        <div className="table-card table-card-flush student-communication-table-wrap">
          <table className="data-table student-communication-table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Subject</th>
                <th>Course</th>
                <th>Status</th>
                <th className="students-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {communications.map((row) => (
                <tr key={row.id}>
                  <td data-label="Sent">{dateTimeLabel(row.sentAt)}</td>
                  <td data-label="Subject">
                    <span className="student-communication-subject">{row.subject}</span>
                  </td>
                  <td data-label="Course">{row.course?.code || "—"}</td>
                  <td data-label="Status">
                    <span className={`comm-status comm-status-${row.status}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td data-label="Action" className="students-col-action">
                    <button type="button" className="text-btn" onClick={() => setViewing(row)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No messages sent to this student yet.</p>
      )}
      <ViewStudentMessageModal open={Boolean(viewing)} message={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}