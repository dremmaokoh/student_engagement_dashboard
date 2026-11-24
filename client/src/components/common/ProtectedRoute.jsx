import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import LoadingState from "./LoadingState.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="page">
        <section className="card">
          <LoadingState loading variant="section" size="lg" delay={80} message="Preparing your workspace…" />
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
