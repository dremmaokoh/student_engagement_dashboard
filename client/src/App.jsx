import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import { AuthProvider } from "./features/auth/AuthContext.jsx";
import CourseLegacyRedirect from "./components/courses/CourseLegacyRedirect.jsx";
import CourseWorkspaceIndexRedirect from "./components/courses/CourseWorkspaceIndexRedirect.jsx";
import CourseOverviewPage from "./pages/CourseOverviewPage.jsx";
import CourseResultDetailPage from "./pages/CourseResultDetailPage.jsx";
import CourseResultsPage from "./pages/CourseResultsPage.jsx";
import CourseSettingsPage from "./pages/CourseSettingsPage.jsx";
import SettingsCourseClassificationPage from "./pages/SettingsCourseClassificationPage.jsx";
import CourseMonitoringPage from "./pages/CourseMonitoringPage.jsx";
import CoursesPage from "./pages/CoursesPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StudentDetailPage from "./pages/StudentDetailPage.jsx";
import StudentsPage from "./pages/StudentsPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:courseId" element={<Outlet />}>
              <Route index element={<CourseWorkspaceIndexRedirect />} />
              <Route path="overview" element={<CourseOverviewPage />} />
              <Route path="monitoring" element={<CourseMonitoringPage />} />
              <Route path="students" element={<CourseLegacyRedirect />} />
              <Route path="imports" element={<CourseLegacyRedirect openPanel="import" />} />
              <Route path="configuration" element={<CourseLegacyRedirect openPanel="config" />} />
              <Route path="settings" element={<CourseSettingsPage />} />
              <Route path="classification-settings" element={<CourseSettingsPage />} />
              <Route path="results/:resultId" element={<CourseResultDetailPage />} />
              <Route path="results" element={<CourseResultsPage />} />
              <Route path="history" element={<CourseResultsPage />} />
            </Route>
            <Route path="/settings/classification/:courseId" element={<SettingsCourseClassificationPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:studentId" element={<StudentDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
