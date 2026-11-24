import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoadingState from "../components/common/LoadingState.jsx";
import CourseTabs from "../components/courses/CourseTabs.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { apiRequest, downloadAuthenticated } from "../services/api.js";

export default function CourseImportsPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [history, setHistory] = useState([]);
  const [file, setFile] = useState(null);
  const [periodStart, setPeriodStart] = useState("2026-10-01");
  const [periodEnd, setPeriodEnd] = useState("2026-10-31");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [courseResult, imports] = await Promise.all([
        apiRequest(`/api/v1/courses/${courseId}`),
        apiRequest(`/api/v1/courses/${courseId}/imports`),
      ]);
      setCourse(courseResult.data.course);
      setHistory(imports.data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [courseId]);

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
      await load();
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
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function downloadTemplate() {
    setError("");
    try {
      const params = new URLSearchParams({
        periodStart,
        periodEnd,
      });
      await downloadAuthenticated(
        `/api/v1/courses/${courseId}/imports/template?${params.toString()}`,
        `${course?.code || "course"}-activity-import-template.csv`,
      );
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <main className="content">
        <LoadingState loading variant="page" size="lg" message="Loading import history…" />
      </main>
    );
  }

  return (
    <main className="content">
      <header className="content-header page-context-header">
        <BackLink fallbackTo="/courses" fallbackLabel="Back to Courses" />
        <Breadcrumbs
          items={[
            { label: "Overview", to: "/overview" },
            { label: "Courses", to: "/courses" },
            { label: course?.code || "Course", to: `/courses/${courseId}/overview` },
            { label: "Activity Imports" },
          ]}
        />
        <h1>Activity Imports</h1>
        <p className="lede">
          Import LMS activity records for students enrolled in {course?.code}. Download the template to receive one row
          per enrolled student (identifier and name pre-filled). Add activity figures for the selected monitoring period,
          then preview before confirming.
        </p>
        <p className="lede">Missing cells stay missing and are never stored as zero.</p>
      </header>
      <CourseTabs courseId={courseId} />

      <section className="card">
        <h2>Upload CSV</h2>
        <p className="lede">
          Import LMS activity for students already associated with this course. If the roster is empty, import
          course/enrolment data from Courses first.
        </p>
        <button type="button" className="secondary-btn" onClick={downloadTemplate}>
          Download template
        </button>
        <form className="stack-form" onSubmit={previewFile}>
          <label htmlFor="periodStart">Monitoring period start</label>
          <input
            id="periodStart"
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            required
          />
          <label htmlFor="periodEnd">Monitoring period end</label>
          <input
            id="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            required
          />
          <label htmlFor="file">CSV file</label>
          <input
            id="file"
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
          <button type="submit" className="primary-btn" disabled={working || !file}>
            {working ? "Checking file…" : "Preview import"}
          </button>
        </form>
      </section>

      {preview ? (
        <section className="card table-card">
          <h2>Preview</h2>
          <p>
            Valid: {preview.validCount}. Rejected: {preview.rejectedCount}.
            {preview.status === "confirmed"
              ? ` Imported: ${preview.importedCount}. Skipped: ${preview.skippedCount}.`
              : null}
          </p>
          {preview.errors?.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-serial">S/N</th>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.map((item, index) => (
                  <tr key={`${item.rowNumber}-${item.field}`}>
                    <td className="col-serial">{index + 1}</td>
                    <td>{item.rowNumber}</td>
                    <td>{item.field}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {preview.status === "previewed" ? (
            <button type="button" className="primary-btn" onClick={confirmPreview} disabled={working}>
              {working ? "Importing…" : "Confirm import"}
            </button>
          ) : (
            <p className="badge badge-session-ok">Import confirmed</p>
          )}
        </section>
      ) : null}

      <section className="card table-card">
        <h2>Import history</h2>
        {history.length === 0 ? <p className="lede">No imports yet.</p> : null}
        {history.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>File</th>
                <th>Status</th>
                <th>Valid</th>
                <th>Rejected</th>
                <th>Imported</th>
                <th>Skipped</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={item.id}>
                  <td className="col-serial">{index + 1}</td>
                  <td>{item.filename}</td>
                  <td>{item.status}</td>
                  <td>{item.validCount}</td>
                  <td>{item.rejectedCount}</td>
                  <td>{item.importedCount}</td>
                  <td>{item.skippedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
