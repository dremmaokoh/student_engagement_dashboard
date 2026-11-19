import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { readCoursePeriod } from "../../lib/coursePeriod.js";

/**
 * Preserves query string when redirecting legacy course workspace paths to Monitoring.
 */
export default function CourseLegacyRedirect({ openPanel }) {
  const { courseId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const period = readCoursePeriod(searchParams);
  const params = new URLSearchParams(searchParams);
  params.set("periodStart", period.periodStart);
  params.set("periodEnd", period.periodEnd);
  if (openPanel === "import") {
    params.set("openImport", "1");
  }
  if (openPanel === "config") {
    params.set("openConfig", "1");
  }
  if (openPanel === "enrol") {
    params.set("openEnrol", "1");
  }
  const target = `/courses/${courseId}/monitoring?${params.toString()}`;
  if (location.pathname.includes("/students")) {
    return <Navigate to={target} replace />;
  }
  return <Navigate to={target} replace />;
}