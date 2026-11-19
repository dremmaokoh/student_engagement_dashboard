const ICONS = {
  lastActivity: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm1 4v5.2l3.4 2-1 1.7L11 13V7h2z"
      />
    </svg>
  ),
  materialAccess: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M6 4h9l5 5v11H6V4zm8 1.5V10h4.5L14 5.5zM8 13h10v1.5H8V13zm0 3h10V17.5H8V16z" />
    </svg>
  ),
  assignmentSubmission: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v16H4V5h4l1-2zm1.5 9.2-1.4 1.4L12 16.5l6-6-1.4-1.4L12 13.7l-1.5-1.5z"
      />
    </svg>
  ),
};

export default function IndicatorGlyph({ indicatorKey }) {
  return <span className={`indicator-glyph glyph-${indicatorKey}`}>{ICONS[indicatorKey]}</span>;
}
