import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import AddStudentModal from "../components/students/AddStudentModal.jsx";
import StudentCourseBadges from "../components/students/StudentCourseBadges.jsx";
import StudentAvatar from "../components/students/StudentAvatar.jsx";
import StudentParticipationCell from "../components/students/StudentParticipationCell.jsx";
import { studentDetailPath } from "../lib/studentDirectory.js";
import { returnNavigationState } from "../lib/returnNavigation.js";
import { apiRequest } from "../services/api.js";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function StudentsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [directory, setDirectory] = useState({ items: [], total: 0, page: 1, limit: 25, totalPages: 1 });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    matriculationNumber: "",
    email: "",
    courseId: "",
  });

  const courseId = searchParams.get("courseId") || "";
  const classification = searchParams.get("classification") || "";
  const sortBy = searchParams.get("sortBy") || "fullName";
  const appliedQuery = searchParams.get("q") || "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(10, Number.parseInt(searchParams.get("limit") || "25", 10) || 25));

  const [searchInput, setSearchInput] = useState(appliedQuery);
  useEffect(() => {
    setSearchInput(appliedQuery);
  }, [appliedQuery]);

  const hasFilters = Boolean(appliedQuery || courseId || classification);
  const returnState = returnNavigationState(`${location.pathname}${location.search}`, "Back to Students");

  function updateParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  }

  async function loadCourses() {
    try {
      const result = await apiRequest("/api/v1/courses?limit=100");
      setCourses(result.data.items);
    } catch {
      setCourses([]);
    }
  }

  async function loadDirectory() {
    setLoading(true);
    setDirectoryError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (appliedQuery) {
        params.set("q", appliedQuery);
      }
      if (courseId) {
        params.set("courseId", courseId);
      }
      if (classification) {
        params.set("classification", classification);
      }
      if (sortBy) {
        params.set("sortBy", sortBy);
      }
      const result = await apiRequest(`/api/v1/students?${params.toString()}`);
      setDirectory({
        items: result.data.items,
        total: result.data.total,
        page: result.data.page,
        limit: result.data.limit,
        totalPages: result.data.totalPages,
      });
    } catch (err) {
      setDirectoryError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [appliedQuery, courseId, classification, sortBy, page, limit]);

  async function onCreateStudent(event) {
    event.preventDefault();
    if (!form.courseId) {
      setError("Select a course to enrol the student.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const created = await apiRequest("/api/v1/students", {
        method: "POST",
        body: {
          fullName: form.fullName,
          matriculationNumber: form.matriculationNumber,
          email: form.email || undefined,
        },
      });
      await apiRequest(`/api/v1/courses/${form.courseId}/enrollments`, {
        method: "POST",
        body: { studentId: created.data.student.id },
      });
      setForm({ fullName: "", matriculationNumber: "", email: "", courseId: "" });
      setModalOpen(false);
      setSuccess("Student created and enrolled successfully.");
      await loadDirectory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearchInput("");
    updateParams({ q: "", courseId: "", classification: "", page: "1" });
  }

  const pageStart = directory.total === 0 ? 0 : (directory.page - 1) * directory.limit + 1;
  const pageEnd =
    directory.total === 0 ? 0 : Math.min((directory.page - 1) * directory.limit + directory.items.length, directory.total);

  const emptyCourses = courses.length === 0;

  const emptyMessage = useMemo(() => {
    if (loading) {
      return null;
    }
    if (emptyCourses) {
      return "no-courses";
    }
    if (directory.total === 0 && !hasFilters) {
      return "no-students";
    }
    if (directory.total === 0 && hasFilters) {
      return "no-results";
    }
    return null;
  }, [loading, emptyCourses, directory.total, hasFilters]);

  return (
    <main className="content students-page">
      <header className="students-page-header">
        <div>
          <h1>Students</h1>
          <p className="lede students-lede">
            Manage students across your courses and review their participation status.
          </p>
        </div>
        <div className="students-header-actions">
          <Link className="secondary-btn students-import-btn" to="/courses">
            Import students
          </Link>
          <button type="button" className="primary-btn students-add-btn" onClick={() => setModalOpen(true)}>
            + Add student
          </button>
        </div>
      </header>

      {success ? <p className="students-success">{success}</p> : null}
      {error && !modalOpen ? (
        <p className="form-error students-page-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card students-directory-card" aria-labelledby="students-directory-heading">
        <div className="students-directory-head">
          <div>
            <h2 id="students-directory-heading">Student Directory</h2>
            <p className="panel-desc">View, search, and manage students enrolled across your courses.</p>
          </div>
          <span className="students-count-badge">
            {loading ? "…" : `${directory.total} student${directory.total === 1 ? "" : "s"}`}
          </span>
        </div>

        <form
          className="students-filter-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: searchInput.trim(), page: "1" });
          }}
        >
          <div className="filter-field students-search-field">
            <label htmlFor="studentSearch">Search</label>
            <input
              id="studentSearch"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search student name or ID…"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="studentCourse">Course</label>
            <select
              id="studentCourse"
              value={courseId}
              onChange={(event) => updateParams({ courseId: event.target.value, page: "1" })}
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="studentClass">Participation status</label>
            <select
              id="studentClass"
              value={classification}
              onChange={(event) => updateParams({ classification: event.target.value, page: "1" })}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="REQUIRING_ATTENTION">Requiring Attention</option>
              <option value="INACTIVE">Inactive</option>
              <option value="INSUFFICIENT_DATA">Insufficient Data</option>
              <option value="NOT_CLASSIFIED">Not Yet Classified</option>
            </select>
          </div>
          <button type="submit" className="secondary-btn students-search-btn">
            Search
          </button>
          <div className="filter-field">
            <label htmlFor="studentSort">Sort by</label>
            <select
              id="studentSort"
              value={sortBy}
              onChange={(event) => updateParams({ sortBy: event.target.value, page: "1" })}
            >
              <option value="fullName">Student name</option>
              <option value="matriculationNumber">Student ID</option>
            </select>
          </div>
          {hasFilters ? (
            <button type="button" className="text-btn" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </form>

        {directoryError ? (
          <div className="students-error-banner" role="alert">
            <p className="form-error">{directoryError}</p>
            <button type="button" className="secondary-btn" onClick={loadDirectory}>
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="students-skeleton" role="status" aria-live="polite">
            <span className="visually-hidden">Loading students…</span>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton-row" />
            ))}
          </div>
        ) : null}

        {emptyMessage === "no-courses" ? (
          <div className="students-empty students-empty-compact">
            <strong>No courses available</strong>
            <p>Create or import a course before you can enrol students.</p>
            <Link className="text-btn" to="/courses">
              Go to Courses →
            </Link>
          </div>
        ) : null}

        {emptyMessage === "no-students" ? (
          <div className="students-empty students-empty-compact">
            <strong>No students yet</strong>
            <p>
              Students added to your courses will appear here. Import your student list or add an individual student to
              get started.
            </p>
            <div className="students-empty-actions">
              <Link className="secondary-btn" to="/courses">
                Import students
              </Link>
              <button type="button" className="primary-btn" onClick={() => setModalOpen(true)}>
                + Add student
              </button>
            </div>
          </div>
        ) : null}

        {emptyMessage === "no-results" ? (
          <div className="students-empty students-empty-compact">
            <strong>No students found</strong>
            <p>Try adjusting your search or filters to find the student you&apos;re looking for.</p>
            <button type="button" className="text-btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : null}

        {!loading && directory.items.length > 0 ? (
          <>
            <div className="table-card students-table-wrap">
              <table className="data-table students-directory-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student ID</th>
                    <th>Courses</th>
                    <th>Participation status</th>
                    <th className="students-col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.items.map((student) => {
                    const detailPath = studentDetailPath(student.id);
                    return (
                      <tr key={student.id}>
                        <td className="students-col-name">
                          <div className="student-name-row">
                            <StudentAvatar fullName={student.fullName} size="sm" />
                            <div className="student-name" title={student.fullName}>
                              {student.fullName}
                            </div>
                          </div>
                          {student.email ? (
                            <div className="student-email muted" title={student.email}>
                              {student.email}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span className="id-badge">{student.matriculationNumber}</span>
                        </td>
                        <td>
                          <StudentCourseBadges courses={student.courses} />
                        </td>
                        <td>
                          <StudentParticipationCell courseResults={student.courseResults} />
                        </td>
                        <td className="students-col-action">
                          {detailPath ? (
                            <Link className="text-btn students-view-btn" to={detailPath} {...returnState}>
                              View student →
                            </Link>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="students-table-footer">
              <p className="muted students-footer-summary">
                Showing {pageStart}–{pageEnd} of {directory.total} students
              </p>
              <div className="students-footer-controls">
                <label className="students-rows-label" htmlFor="studentsPageSize">
                  Rows
                </label>
                <select
                  id="studentsPageSize"
                  value={limit}
                  onChange={(event) => updateParams({ limit: event.target.value, page: "1" })}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {page} of {directory.totalPages}
                </span>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={page >= directory.totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </section>

      <AddStudentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setError("");
        }}
        courses={courses}
        fullName={form.fullName}
        matriculationNumber={form.matriculationNumber}
        email={form.email}
        courseId={form.courseId}
        saving={saving}
        error={modalOpen ? error : ""}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onSubmit={onCreateStudent}
      />
    </main>
  );
}