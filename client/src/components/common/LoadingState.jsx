import { useDelayedLoading } from "../../hooks/useDelayedLoading.js";

export function LoadingSpinner({ size = "md" }) {
  return (
    <span className={`loading-spinner loading-spinner--${size}`} aria-hidden="true">
      <span className="loading-spinner__ring" />
      <span className="loading-spinner__arc" />
    </span>
  );
}

export default function LoadingState({
  loading,
  message = "Loading…",
  variant = "inline",
  size = "md",
  delay = 180,
  className = "",
}) {
  const { mounted, visible } = useDelayedLoading(loading, { delay });

  if (!mounted) {
    return null;
  }

  const classes = ["loading-state", `loading-state--${variant}`, visible ? "is-visible" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="status" aria-live="polite" aria-busy="true">
      <LoadingSpinner size={size} />
      <span className="loading-state__message">{message}</span>
    </div>
  );
}
