import { Navigate, useParams } from "react-router-dom";

/** Legacy course settings URL → central Settings course configuration. */
export default function CourseSettingsPage() {
  const { courseId } = useParams();
  return <Navigate to={`/settings/classification/${courseId}`} replace />;
}