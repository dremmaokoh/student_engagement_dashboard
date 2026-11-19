const PATHS = {
  ACTIVE:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.5-4.5 1.4 1.4-5.9 5.9z",
  REQUIRING_ATTENTION:
    "M12 3 2 20h20L12 3zm0 6.5c.6 0 1 .4 1 1v3.2c0 .6-.4 1-1 1s-1-.4-1-1V10.5c0-.6.4-1 1-1zm0 8.2a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2z",
  INACTIVE:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11H7v-2h10v2z",
  INSUFFICIENT_DATA:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.9 14.2h-1.8V14h1.8v2.2zM12 7.2c1.8 0 3.1 1.2 3.1 2.9 0 1.3-.7 2-1.8 2.6-.8.5-1.1.8-1.1 1.5v.4H10.5V14c0-1.2.7-1.9 1.8-2.6.8-.5 1.1-.8 1.1-1.3 0-.7-.6-1.2-1.4-1.2-.9 0-1.5.5-1.6 1.3H8.6C8.8 8.4 10.2 7.2 12 7.2z",
  NOT_APPLICABLE:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5.1 13.5L13.6 12l3.5-3.5-1.4-1.4L12 10.6 8.5 7.1 7.1 8.5 10.6 12l-3.5 3.5 1.4 1.4L12 13.4l3.5 3.5 1.6-1.4z",
  CALCULATED:
    "M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z",
  ENROLLED:
    "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7.5 8v-1.2c0-2.5 3.4-3.8 7.5-3.8s7.5 1.3 7.5 3.8V20H4.5z",
};

export default function StatusIcon({ status, size = 18 }) {
  const path = PATHS[status] || PATHS.INSUFFICIENT_DATA;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="status-icon">
      <path fill="currentColor" d={path} />
    </svg>
  );
}
