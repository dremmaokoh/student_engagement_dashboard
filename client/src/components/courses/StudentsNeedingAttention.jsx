import { Link } from "react-router-dom";
import ContentSkeleton from "../common/ContentSkeleton.jsx";
import { skeletonColumns } from "../../lib/skeletonColumns.js";
import ClassificationBadge from "../design/ClassificationBadge.jsx";
import { formatScore } from "../../lib/classifications.js";
import { courseMonitoringPath } from "../../lib/coursePeriod.js";
import { studentDetailPath } from "../../lib/studentDirectory.js";
import { returnNavigationState } from "../../lib/returnNavigation.js";

export default function StudentsNeedingAttention({
  items = [],
  loading = false,
  courseId,
  periodStart,
  periodEnd,
  overviewPath,
}) {
  const returnState = returnNavigationState(overviewPath, "Back to course overview");

  return (
    <section className="card course-overview-section course-overview-attention" aria-labelledby="attention-heading">
      <div className="course-overview-attention-head">
        <div>
          <h2 id="attention-heading">Students Needing Attention</h2>
          <p className="panel-desc">Inactive and requiring attention from the latest classification run.</p>
        </div>
        <Link
          className="secondary-btn course-overview-view-all"
          to={courseMonitoringPath(courseId, { periodStart, periodEnd })}
        >
          View all students
        </Link>
      </div>

      <ContentSkeleton
        loading={loading}
        variant="table"
        columns={skeletonColumns("attention")}
        rows={4}
        tableClassName="students-directory-table course-overview-attention-table"
        wrapClassName="table-card students-table-wrap"
        label="Loading student records…"
      />
      {!loading && items.length === 0 ? (
        <p className="course-overview-attention-empty">No students currently require attention.</p>
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="table-card students-table-wrap">
          <table className="data-table students-directory-table course-overview-attention-table">
            <thead>
              <tr>
                <th className="col-serial">S/N</th>
                <th>Student</th>
                <th className="course-overview-col-id">Student ID</th>
                <th className="course-overview-col-score">Engagement Score</th>
                <th>Classification</th>
                <th className="students-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const detailPath = studentDetailPath(item.studentId);
                return (
                  <tr key={item.id} className={`row-status-${item.classification}`}>
                    <td className="col-serial">{index + 1}</td>
                    <td className="students-col-name">
                      <span className="student-name" title={item.student?.fullName}>
                        {item.student?.fullName}
                      </span>
                    </td>
                    <td className="course-overview-col-id">
                      <span className="id-badge">{item.student?.matriculationNumber}</span>
                    </td>
                    <td className="course-overview-col-score">{formatScore(item.displayScore)}</td>
                    <td>
                      <ClassificationBadge classification={item.classification} />
                    </td>
                    <td className="students-col-action">
                      {detailPath ? (
                        <Link className="text-btn students-view-btn" to={detailPath} {...returnState}>
                          View student →
                        </Link>
                      ) : (
                        <Link className="text-btn students-view-btn" to={`/courses/${courseId}/results/${item.id}`}>
                          View evidence →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}