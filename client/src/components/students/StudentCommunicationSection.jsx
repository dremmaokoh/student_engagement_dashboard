import { useState } from "react";
import ContentSkeleton from "../common/ContentSkeleton.jsx";
import ViewStudentMessageModal from "./ViewStudentMessageModal.jsx";
import { skeletonColumns } from "../../lib/skeletonColumns.js";

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
      <ContentSkeleton
        loading={loading}
        variant="table"
        columns={skeletonColumns("messages")}
        rows={3}
        tableClassName="student-communication-table"
        wrapClassName="table-card table-card-flush student-communication-table-wrap"
        label="Loading message history…"
      />
      {!loading && communications?.length ? (
        <div className="table-card table-card-flush student-communication-table-wrap">
          <table className="data-table student-communication-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Sent</th>
                <th>Subject</th>
                <th>Course</th>
                <th>Status</th>
                <th className="students-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {communications.map((row, index) => (
                <tr key={row.id}>
                  <td data-label="S/N" className="col-serial">{index + 1}</td>
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
      ) : !loading ? (
        <p className="muted">No messages sent to this student yet.</p>
      ) : null}
      <ViewStudentMessageModal open={Boolean(viewing)} message={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}