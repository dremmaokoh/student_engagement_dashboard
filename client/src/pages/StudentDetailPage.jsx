import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ClassificationBadge from "../components/design/ClassificationBadge.jsx";
import BackLink from "../components/layout/BackLink.jsx";
import SendStudentMessageModal from "../components/students/SendStudentMessageModal.jsx";
import StudentAvatar from "../components/students/StudentAvatar.jsx";
import StudentCommunicationSection from "../components/students/StudentCommunicationSection.jsx";
import StudentCourseBadges from "../components/students/StudentCourseBadges.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { formatScore } from "../lib/classifications.js";
import {
  formatMonitoringPeriod,
  participationSummaryLines,
} from "../lib/studentDirectory.js";
import { apiRequest } from "../services/api.js";

function dateLabel(value) {
  if (!value) {
    return "—";
  }
  return String(value).slice(0, 10);
}

function accessLabel(accessed, available) {
  if (accessed == null && available == null) {
    return "—";
  }
  if (available == null) {
    return String(accessed ?? "—");
  }
  return `${accessed ?? "—"} / ${available}`;
}

function assignmentLabel(submitted, due) {
  if (submitted == null && due == null) {
    return "—";
  }
  if (due == null) {
    return String(submitted ?? "—");
  }
  return `${submitted ?? "—"} / ${due}`;
}

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get("courseId") || "";
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const loadCommunications = useCallback(async () => {
    setCommunicationsLoading(true);
    try {
      const result = await apiRequest(`/api/v1/students/${studentId}/communications?limit=50`);
      setCommunications(result.data?.items || []);
    } catch {
      setCommunications([]);
    } finally {
      setCommunicationsLoading(false);
    }
  }, [studentId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(`/api/v1/students/${studentId}`);
      setStudent(result.data.student);
    } catch (err) {
      setStudent(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [studentId]);

  useEffect(() => {
    if (student) {
      loadCommunications();
    }
  }, [student, loadCommunications]);

  const courseContext = useMemo(() => {
    if (!courseIdParam || !student?.courses?.length) {
      return null;
    }
    return student.courses.find((course) => course.id === courseIdParam) || null;
  }, [courseIdParam, student?.courses]);

  const summaryLines = useMemo(
    () => participationSummaryLines(student?.courseResults || []),
    [student?.courseResults],
  );

  const courseRows = useMemo(() => {
    const rows = student?.courseResults || [];
    return [...rows].sort((left, right) =>
      String(left.course?.code || "").localeCompare(String(right.course?.code || "")),
    );
  }, [student?.courseResults]);

  if (loading) {
    return (
      <main className="content student-detail-page">
        <p className="lede" role="status">
          Loading student profile…
        </p>
        <div className="students-skeleton student-detail-skeleton" aria-hidden="true">
          <div className="skeleton-bar skeleton-bar-lg" />
          <div className="skeleton-bar" />
          <div className="skeleton-bar" />
        </div>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="content student-detail-page">
        <p className="form-error" role="alert">
          {error || "Student not found."}
        </p>
        <button type="button" className="secondary-btn" onClick={load}>
          Retry
        </button>
        <BackLink fallbackTo="/students" fallbackLabel="Back to Students" />
      </main>
    );
  }

  return (
    <main className="content student-detail-page">
      <header className="student-detail-header">
        <BackLink fallbackTo="/students" fallbackLabel="Back to Students" />
        <div className="student-detail-identity card student-profile-card">
          <div className="student-detail-identity-main">
            <StudentAvatar fullName={student.fullName} size="lg" />
            <div className="student-profile-body">
              <p className="student-profile-eyebrow">Student profile</p>
              <h1>{student.fullName}</h1>
              <div className="student-profile-fields">
                <div className="student-profile-field">
                  <span className="student-profile-label">Student ID</span>
                  <span className="id-badge">{student.matriculationNumber}</span>
                </div>
                <div className="student-profile-field">
                  <span className="student-profile-label">Email</span>
                  <span className="student-profile-value">
                    {student.email || <span className="muted">Not on file</span>}
                  </span>
                </div>
              </div>
              <div className="student-profile-courses-block">
                <span className="student-profile-label">Enrolled courses</span>
                <StudentCourseBadges courses={student.courses} maxVisible={12} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <StudentCommunicationSection
        communications={communications}
        loading={communicationsLoading}
        onSendClick={() => setComposerOpen(true)}
      />

      <SendStudentMessageModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        student={student}
        lecturerEmail={user?.email}
        courses={student.courses}
        initialCourseId={courseContext?.id || ""}
        onSent={() => loadCommunications()}
      />

      <section className="card student-detail-summary" aria-labelledby="participation-summary-heading">
        <h2 id="participation-summary-heading">Participation summary</h2>
        <p className="panel-desc">Classifications across all enrolled courses for this student.</p>
        <div className="student-summary-grid">
          {summaryLines.length ? (
            summaryLines.map((line) => (
              <div key={line.key} className={`student-summary-stat student-summary-stat--${line.key}`}>
                <span className="student-summary-count">{line.count}</span>
                <span className="student-summary-label">{line.label}</span>
              </div>
            ))
          ) : (
            <p className="muted">No participation classifications recorded yet.</p>
          )}
        </div>
      </section>

      <section className="card table-card" aria-labelledby="course-participation-heading">
        <h2 id="course-participation-heading">Course participation</h2>
        <p className="panel-desc">
          Each row shows participation for one course. Expand a row to review observable evidence used in classification.
        </p>
        {courseRows.length === 0 ? (
          <p className="muted">This student is not enrolled in any of your active courses.</p>
        ) : (
          <div className="student-detail-table-wrap">
            <table className="data-table student-detail-courses-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Classification</th>
                  <th>Score</th>
                  <th>Monitoring period</th>
                  <th className="students-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {courseRows.map((row) => {
                  const expanded = expandedCourseId === row.course.id;
                  return (
                    <Fragment key={row.course.id}>
                      <tr>
                        <td>
                          <span className="student-detail-course-code">{row.course.code}</span>
                          <span className="muted student-detail-course-name">{row.course.name}</span>
                        </td>
                        <td>
                          {row.classification ? (
                            <ClassificationBadge classification={row.classification} />
                          ) : (
                            <span className="muted">Not yet classified</span>
                          )}
                        </td>
                        <td>{formatScore(row.displayScore)}</td>
                        <td>{formatMonitoringPeriod(row.monitoringPeriodStart, row.monitoringPeriodEnd)}</td>
                        <td className="students-col-action">
                          <button
                            type="button"
                            className="text-btn"
                            aria-expanded={expanded}
                            onClick={() => setExpandedCourseId(expanded ? null : row.course.id)}
                          >
                            {expanded ? "Hide evidence" : "Evidence"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="student-detail-evidence-row">
                          <td colSpan={5}>
                            <div className="student-detail-evidence-panel">
                              <h3 className="student-detail-evidence-title">Evidence — {row.course.code}</h3>
                              <dl className="student-evidence-dl">
                                <div>
                                  <dt>Last Recorded Login</dt>
                                  <dd>{dateLabel(row.lastActivityAt)}</dd>
                                </div>
                                <div>
                                  <dt>Course materials accessed</dt>
                                  <dd>{accessLabel(row.materialsAccessed, row.materialsAvailable)}</dd>
                                </div>
                                <div>
                                  <dt>Assignments submitted</dt>
                                  <dd>{assignmentLabel(row.assignmentsSubmitted, row.assignmentsDue)}</dd>
                                </div>
                                <div>
                                  <dt>Classification generated</dt>
                                  <dd>{dateLabel(row.generatedAt)}</dd>
                                </div>
                              </dl>
                              <div className="student-detail-evidence-actions">
                                <Link className="secondary-btn" to={`/courses/${row.course.id}/overview`}>
                                  Course overview
                                </Link>
                                {row.resultId ? (
                                  <Link
                                    className="primary-btn"
                                    to={`/courses/${row.course.id}/results/${row.resultId}`}
                                  >
                                    Full participation evidence
                                  </Link>
                                ) : (
                                  <Link className="text-btn" to={`/courses/${row.course.id}/monitoring`}>
                                    View course roster
                                  </Link>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}