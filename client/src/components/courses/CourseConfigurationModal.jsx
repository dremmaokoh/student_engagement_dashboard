import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConfigurationReadOnlyPanel from "../settings/ConfigurationReadOnlyPanel.jsx";
import { apiRequest } from "../../services/api.js";
import { courseMonitoringPath } from "../../lib/coursePeriod.js";

export default function CourseConfigurationModal({ open, onClose, courseId, periodStart, periodEnd }) {
  const dialogRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [globalWeights, setGlobalWeights] = useState(null);
  const [error, setError] = useState("");
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
        const [configResult, weightsResult] = await Promise.all([
          apiRequest(`/api/v1/courses/${courseId}/classification-config`),
          apiRequest("/api/v1/settings/indicator-weights"),
        ]);
        if (!cancelled) {
          setConfig(configResult.data.config);
          setGlobalWeights(weightsResult.data.weights);
        }
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

  const monitoringPath = courseMonitoringPath(courseId, { periodStart, periodEnd });

  return (
    <dialog ref={dialogRef} className="student-modal course-workspace-modal course-config-modal" onClose={onClose}>
      <div className="student-modal-form course-workspace-modal-body">
        <header className="student-modal-header">
          <h2>View configuration</h2>
          <button type="button" className="text-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className="panel-desc">Read-only classification rules for this course. Edit in Settings to change rules.</p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="muted">Loading configuration…</p> : null}
        {!loading ? <ConfigurationReadOnlyPanel config={config} globalWeights={globalWeights} /> : null}
        <div className="modal-actions">
          <Link
            className="primary-btn"
            to={`/settings/classification/${courseId}`}
            state={{ from: monitoringPath, fromLabel: "Back to Monitoring" }}
            onClick={onClose}
          >
            Edit configuration
          </Link>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}