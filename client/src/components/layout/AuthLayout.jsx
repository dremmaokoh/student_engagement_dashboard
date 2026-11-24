import AuthCarousel from "./AuthCarousel.jsx";

function BrandMark() {
  return (
    <span className="auth-brand__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.5C10.4 5.3 8.5 4.8 5.5 5v12.2c3-.2 4.9.3 6.5 1.5 1.6-1.2 3.5-1.7 6.5-1.5V5c-3-.2-4.9.3-6.5 1.5Z" />
        <path d="M12 6.5v12.2" />
        <path d="M8.4 10.1h1.8M13.8 10.1h1.8M8.4 13.3h1.8M13.8 13.3h1.8" />
      </svg>
    </span>
  );
}

export default function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <aside className="auth-visual">
        <div className="auth-visual__brand">
          <BrandMark />
          <span>Student Engagement Dashboard</span>
        </div>
        <AuthCarousel />
      </aside>

      <section className="auth-form-panel">
        <div className="auth-form-shell">
          <header className="auth-form-header">
            {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {description ? <p className="auth-description">{description}</p> : null}
          </header>
          {children}
        </div>

        <div className="auth-form-panel__footer" aria-hidden="true">
          <span className="auth-form-panel__footer-dot" />
          <span>Secure lecturer access</span>
        </div>
      </section>
    </main>
  );
}
