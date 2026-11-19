import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.jsx";

const links = [
  { to: "/overview", label: "Overview", icon: "overview" },
  { to: "/courses", label: "Courses", icon: "courses" },
  { to: "/students", label: "Students", icon: "students" },
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/profile", label: "Profile", icon: "profile" },
];

const ICON_PATHS = {
  overview: "M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 14h8v7H3v-7zm10 0h8v7h-8v-7z",
  courses:
    "M4 4h11l5 5v11H4V4zm10 1.5V10h4.5L14 5.5zM7 13h9v1.5H7V13zm0 3h9v1.5H7V16z",
  students:
    "M9 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm8 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6H3zm13-4c2.8 0 5 2.2 5 5h-5v-5z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM11 2h2l.4 2.2 1.6.9 2-.7 1 1.7-1.5 1.6v1.8l1.5 1.6-1 1.7-2-.7-1.6.9L13 22h-2l-.4-2.2-1.6-.9-2 .7-1-1.7 1.5-1.6v-1.8L5 12.9l1-1.7 2 .7 1.6-.9L11 2z",
  profile:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 13c-3.1 0-5.8-1.8-7-4.4.2-2.3 3.2-3.6 7-3.6s6.8 1.3 7 3.6C17.8 18.2 15.1 20 12 20z",
};

const SIGN_OUT_ICON =
  "M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3zm5.6 4.6L14.2 9l3 3H9v2h8.2l-3 3 1.4 1.4L20 12l-4.4-4.4z";

function NavGlyph({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="nav-glyph" aria-hidden="true">
      <path fill="currentColor" d={ICON_PATHS[name]} />
    </svg>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
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
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
        <div className="sidebar-brand-panel">
          <div className="sidebar-brand">
            <span className="sidebar-mark" aria-hidden="true" />
            <div className="sidebar-brand-text">
              <strong>Student Engagement</strong>
              <p>Dashboard</p>
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
              title={collapsed ? link.label : undefined}
            >
              <NavGlyph name={link.icon} />
              <span className="nav-link-text">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-identity">
            <p className="sidebar-user">{user?.fullName}</p>
            <p className="sidebar-email">{user?.email}</p>
          </div>
          <button
            type="button"
            className="secondary-btn sidebar-signout"
            onClick={logout}
            title={collapsed ? "Sign out" : undefined}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d={SIGN_OUT_ICON} />
            </svg>
            <span className="sidebar-signout-text">Sign out</span>
          </button>
        </div>
      </aside>
      <div className="shell-main" id="main-content">
        <Outlet />
      </div>
    </div>
  );
}
