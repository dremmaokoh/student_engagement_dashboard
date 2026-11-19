export function formatLastRecordedActivity(value, { hasResult = true } = {}) {
  if (!value) {
    return hasResult ? "No recorded activity" : "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return hasResult ? "No recorded activity" : "—";
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}