import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.jsx";

const links = [
  { to: "/overview", label: "Overview" },
  { to: "/courses", label: "Courses" },
  { to: "/students", label: "Students" },
  { to: "/settings", label: "Settings" },
  { to: "/profile", label: "Profile" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
        onClick={() => setNavOpen((open) => !open)}
      >
        Menu
      </button>
      {navOpen ? <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={closeNav} /> : null}
      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-brand-panel">
          <div className="sidebar-brand">
            <span className="sidebar-mark" aria-hidden="true" />
            <div>
              <strong>Student Engagement</strong>
              <p>Lecturer workspace</p>
            </div>
          </div>
        </div>
        <nav aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/overview"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={closeNav}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-user">{user?.fullName}</p>
          <p className="sidebar-email">{user?.email}</p>
          <button type="button" className="secondary-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="shell-main" id="main-content">
        <Outlet />
      </div>
    </div>
  );
}
