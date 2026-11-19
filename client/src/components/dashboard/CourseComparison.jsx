import { Link } from "react-router-dom";
import DistributionBar from "./DistributionBar.jsx";
import { courseOverviewPath } from "../../lib/coursePeriod.js";

export default function CourseComparison({
  items,
  showComparison,
  periodStart,
  periodEnd,
  periodScope = "latest",
}) {
  if (!showComparison) {
    return (
      <section className="card dashboard-panel course-compare-panel" aria-labelledby="course-compare-heading">
        <h2 id="course-compare-heading">Course engagement comparison</h2>
        <p className="panel-desc">Choose “All courses” in the filter bar to compare participation patterns across courses.</p>
      </section>
    );
  }

  if (!items?.length) {
    return (
      <section className="card dashboard-panel course-compare-panel" aria-labelledby="course-compare-heading">
        <h2 id="course-compare-heading">Course engagement comparison</h2>
        <p className="panel-desc">No courses available for comparison.</p>
      </section>
    );
  }

  function overviewLink(item) {
    if (periodScope === "latest" && item.monitoringPeriodStart && item.monitoringPeriodEnd) {
      return courseOverviewPath(item.course.id, {
        periodStart: item.monitoringPeriodStart,
        periodEnd: item.monitoringPeriodEnd,
      });
    }
    if (periodStart && periodEnd) {
      return courseOverviewPath(item.course.id, { periodStart, periodEnd });
    }
    return courseOverviewPath(item.course.id);
  }

  return (
    <section className="card dashboard-panel course-compare-panel table-card" aria-labelledby="course-compare-heading">
      <h2 id="course-compare-heading">Course engagement comparison</h2>
      <p className="panel-desc">
        Enrolment-level classification counts per course. Horizontal bars compare engagement distribution at a glance.
      </p>

      <div className="course-compare-table-wrap">
        <table className="data-table course-compare-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Enrolments</th>
              <th>Active</th>
              <th>Attention</th>
              <th>Inactive</th>
              <th>Insufficient</th>
              <th>Distribution</th>
              <th className="students-col-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const total = item.hasClassification ? item.counts?.total || 0 : 0;
              const barId = `course-dist-${item.course.id}`;

              return (
                <tr key={item.course.id}>
                  <td>
                    <span className="course-code">{item.course.code}</span>
                    <div className="course-name">{item.course.name}</div>
                  </td>
                  <td>{item.enrolledCount}</td>
                  <td>
                    {!item.hasClassification ? (
                      <span className="muted comparison-unclassified">Not yet classified</span>
                    ) : (
                      item.counts.ACTIVE
                    )}
                  </td>
                  <td>
                    {!item.hasClassification ? (
                      <span className="muted comparison-unclassified">Not yet classified</span>
                    ) : (
                      item.counts.REQUIRING_ATTENTION
                    )}
                  </td>
                  <td>
                    {!item.hasClassification ? (
                      <span className="muted comparison-unclassified">Not yet classified</span>
                    ) : (
                      item.counts.INACTIVE
                    )}
                  </td>
                  <td>
                    {!item.hasClassification ? (
                      <span className="muted comparison-unclassified">Not yet classified</span>
                    ) : (
                      item.counts.INSUFFICIENT_DATA
                    )}
                  </td>
                  <td className="course-compare-dist-cell">
                    {!item.hasClassification ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        <span id={barId} className="visually-hidden">
                          {item.course.code} distribution
                        </span>
                        <DistributionBar counts={item.counts} total={total} labelledBy={barId} />
                      </>
                    )}
                  </td>
                  <td className="students-col-action">
                    <Link className="text-btn" to={overviewLink(item)}>
                      View course
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}