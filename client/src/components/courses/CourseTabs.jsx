import { NavLink, useLocation, useParams, useSearchParams } from "react-router-dom";
import { courseWorkspaceQuery } from "../../lib/coursePeriod.js";

function isResultsTabActive(isActive, pathname) {
  if (isActive) {
    return true;
  }
  const parts = pathname.split("/");
  const last = parts[parts.length - 1];
  return last === "history" || last === "results" || parts.includes("results");
}

export default function CourseTabs({ courseId: courseIdProp }) {
  const location = useLocation();
  const { courseId: courseIdParam } = useParams();
  const courseId = courseIdProp || courseIdParam;
  const [searchParams] = useSearchParams();
  const periodSuffix = courseWorkspaceQuery(searchParams);

  if (!courseId) {
    return null;
  }

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
          className={({ isActive }) =>
            isResultsTabActive(isActive, location.pathname) ? "nav-link active" : "nav-link"
          }
        >
          Results &amp; History
        </NavLink>
      </nav>
    </div>
  );
}