import { NavLink, useSearchParams } from "react-router-dom";
import { courseWorkspaceQuery } from "../../lib/coursePeriod.js";

export default function CourseTabs({ courseId }) {
  const [searchParams] = useSearchParams();
  const periodSuffix = courseWorkspaceQuery(searchParams);

  return (
    <div className="course-workspace-nav">
      <nav className="workspace-tabs" aria-label="Course workspace">
        <NavLink
          to={`/courses/${courseId}/overview${periodSuffix}`}
          end
          className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
        >
          Overview
        </NavLink>
        <NavLink
          to={`/courses/${courseId}/monitoring${periodSuffix}`}
          className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
        >
          Monitoring
        </NavLink>
        <NavLink
          to={`/courses/${courseId}/results${periodSuffix}`}
          className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
        >
          Results &amp; History
        </NavLink>
      </nav>
    </div>
  );
}