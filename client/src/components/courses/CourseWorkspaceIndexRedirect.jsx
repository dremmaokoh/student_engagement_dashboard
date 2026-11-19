import { Navigate, useLocation, useParams } from "react-router-dom";

/** Course workspace base URL → overview (preserve query string). */
export default function CourseWorkspaceIndexRedirect() {
  const { courseId } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/courses/${courseId}/overview${search}`} replace />;
}