import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ContentSkeleton from "../components/common/ContentSkeleton.jsx";
import { returnNavigationState } from "../lib/returnNavigation.js";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import { apiRequest, downloadAuthenticated } from "../services/api.js";

const emptyForm = { name: "", code: "", description: "" };

export default function CoursesPage() {
  const location = useLocation();
  const fromCourses = returnNavigationState(`${location.pathname}${location.search}`, "Back to Courses");
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  async function loadCourses(q = search) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) {
        params.set("q", q);
      }
      const result = await apiRequest(`/api/v1/courses?${params.toString()}`);
      setCourses(result.data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  async function onAdd(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/v1/courses", { method: "POST", body: form });
      setForm(emptyForm);
      setShowAdd(false);
      await loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onPreviewFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setImporting(true);
    setError("");
    setImportMessage("");
    setPreview(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await apiRequest("/api/v1/courses/import-roster/preview", {
        method: "POST",
        body,
      });
      setPreview(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!preview?.importId) {
      return;
    }
    setImporting(true);
    setError("");
    try {
      const result = await apiRequest("/api/v1/courses/import-roster/confirm", {
        method: "POST",
        body: { importId: preview.importId },
      });
      setImportMessage(
        `Imported ${result.data.counts.coursesCreated + result.data.counts.coursesUpdated} courses, ${result.data.counts.studentsCreated + result.data.counts.studentsUpdated} students, ${result.data.counts.enrolmentsCreated + result.data.counts.enrolmentsReactivated} enrolments.`,
      );
      setPreview(null);
      await loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="content courses-page">
      <header className="courses-page-header">
        <div>
          <h1>Courses</h1>
          <p className="lede courses-lede">
            View courses available for engagement monitoring. In the standard product these come from an LMS; this
            prototype uses CSV import for testing.
          </p>
        </div>
        <div className="courses-header-actions">
          <button
            type="button"
            className="secondary-btn courses-template-btn"
            onClick={() =>
              downloadAuthenticated("/api/v1/courses/import-roster/template", "course-enrolment-template.csv").catch(
                (err) => setError(err.message),
              )
            }
          >
            Download template
          </button>
          <label className="primary-btn file-btn courses-import-btn">
            {importing ? "Importing…" : "Import courses"}
            <input type="file" accept=".csv,text/csv" hidden disabled={importing} onChange={onPreviewFile} />
          </label>
          {!showAdd ? (
            <button type="button" className="primary-btn courses-add-btn" onClick={() => setShowAdd(true)}>
              + Add course
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="form-error courses-page-error" role="alert">
          {error}
        </p>
      ) : null}
      {importMessage ? (
        <p className="courses-import-message" role="status">
          {importMessage}
        </p>
      ) : null}

      {preview ? (
        <section className="card table-card">
          <h2>Import preview</h2>
          <p className="panel-desc">
            {preview.summary.validRows} valid rows · {preview.summary.invalidRows} invalid ·{" "}
            {preview.summary.uniqueCourses} courses · {preview.summary.uniqueStudents} students
          </p>
          {preview.invalidRows?.length ? (
            <ul>
              {preview.invalidRows.slice(0, 10).map((row) => (
                <li key={row.rowNumber}>
                  Row {row.rowNumber}: {row.errors.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="courses-preview-actions">
            <button
              type="button"
              className="primary-btn"
              disabled={!preview.summary.validRows || importing}
              onClick={confirmImport}
            >
              Confirm import
            </button>
            <button type="button" className="secondary-btn" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {showAdd ? (
        <section className="card">
          <h2>Add course (prototype)</h2>
          <p className="panel-desc">
            Manual creation is optional for testing. Prefer Import courses for the normal prototype flow.
          </p>
          <form className="stack-form" onSubmit={onAdd}>
            <label htmlFor="name">Name</label>
            <input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <label htmlFor="code">Code</label>
            <input id="code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <div className="courses-form-actions">
              <button type="submit" className="primary-btn courses-form-submit" disabled={saving}>
                {saving ? "Saving…" : "Create course"}
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={saving}
                onClick={() => {
                  setShowAdd(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card courses-directory-card" aria-labelledby="courses-list-heading">
        <div className="courses-directory-head">
          <div>
            <h2 id="courses-list-heading">Course list</h2>
            <p className="panel-desc">Search and open courses to review engagement monitoring.</p>
          </div>
          {!loading ? (
            <span className="students-count-badge">
              {courses.length} course{courses.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <form
          className="courses-filter-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            loadCourses(search);
          }}
        >
          <div className="filter-field courses-search-field">
            <label htmlFor="courseSearch">Search</label>
            <input
              id="courseSearch"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Course code or name…"
            />
          </div>
          <button type="submit" className="secondary-btn courses-search-btn">
            Search
          </button>
        </form>

        <ContentSkeleton
          loading={loading}
          variant="table"
          rows={6}
          columns={6}
          label="Fetching course information…"
        />
        {!loading && courses.length === 0 ? (
          <div className="students-empty students-empty-compact">
            <strong>No courses yet</strong>
            <p>Import course details to start monitoring students.</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                downloadAuthenticated("/api/v1/courses/import-roster/template", "course-enrolment-template.csv").catch(
                  (err) => setError(err.message),
                )
              }
            >
              Download template
            </button>
          </div>
        ) : null}
        {!loading && courses.length > 0 ? (
          <div className="table-card students-table-wrap">
            <table className="data-table courses-directory-table">
              <thead>
                <tr>
                  <th className="col-serial">S/N</th>
                  <th className="courses-col-code">Code</th>
                  <th className="courses-col-name">Course</th>
                  <th className="courses-col-students">Students</th>
                  <th className="courses-col-status">Status</th>
                  <th className="students-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, index) => (
                  <tr key={course.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td className="courses-col-code">
                      <span className="course-code-cell">{course.code}</span>
                    </td>
                    <td className="courses-col-name">
                      <div className="course-name-cell" title={course.name}>
                        {course.name}
                      </div>
                      {course.description ? (
                        <div className="muted course-desc-cell" title={course.description}>
                          {course.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="courses-col-students">{course.enrolledCount ?? "—"}</td>
                    <td className="courses-col-status">
                      {!course.counts ? (
                        <span className="badge badge-insufficient">Not yet classified</span>
                      ) : (
                        <div className="courses-status-row">
                          <span className="courses-status-item">
                            <ClassificationBadge classification="ACTIVE" />
                            <span className="courses-status-count">{course.counts.ACTIVE}</span>
                          </span>
                          <span className="courses-status-item">
                            <ClassificationBadge classification="REQUIRING_ATTENTION" />
                            <span className="courses-status-count">{course.counts.REQUIRING_ATTENTION}</span>
                          </span>
                          <span className="courses-status-item">
                            <ClassificationBadge classification="INACTIVE" />
                            <span className="courses-status-count">{course.counts.INACTIVE}</span>
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="students-col-action">
                      <Link
                        className="text-btn students-view-btn courses-open-btn"
                        to={`/courses/${course.id}/overview`}
                        {...fromCourses}
                      >
                        Open course →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}