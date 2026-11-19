export function formatImportTimestamp(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function compactImportLabel(activityImport) {
  if (!activityImport?.filename) {
    return null;
  }
  const stamp = formatImportTimestamp(activityImport.confirmedAt || activityImport.createdAt);
  return stamp ? `${activityImport.filename} · ${stamp}` : activityImport.filename;
}