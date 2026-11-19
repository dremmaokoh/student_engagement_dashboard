const STATUS_ORDER = ["INACTIVE", "REQUIRING_ATTENTION", "ACTIVE", "INSUFFICIENT_DATA", "NOT_CLASSIFIED"];

const STATUS_LABELS = {
  ACTIVE: "Active",
  REQUIRING_ATTENTION: "Requiring attention",
  INACTIVE: "Inactive",
  INSUFFICIENT_DATA: "Insufficient",
  NOT_CLASSIFIED: "Not yet classified",
};

export function summarizeParticipation(courseResults = []) {
  const counts = {
    ACTIVE: 0,
    REQUIRING_ATTENTION: 0,
    INACTIVE: 0,
    INSUFFICIENT_DATA: 0,
    NOT_CLASSIFIED: 0,
  };
  for (const row of courseResults) {
    if (!row.classification) {
      counts.NOT_CLASSIFIED += 1;
    } else if (counts[row.classification] !== undefined) {
      counts[row.classification] += 1;
    }
  }
  return counts;
}

export function participationSummaryLines(courseResults) {
  const counts = summarizeParticipation(courseResults);
  return STATUS_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    label: STATUS_LABELS[key],
    count: counts[key],
  }));
}

export function studentDetailPath(studentId, { courseId } = {}) {
  if (!studentId) {
    return null;
  }
  const params = new URLSearchParams();
  if (courseId) {
    params.set("courseId", courseId);
  }
  const query = params.toString();
  return `/students/${studentId}${query ? `?${query}` : ""}`;
}

export function studentInitials(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatMonitoringPeriod(start, end) {
  if (!start && !end) {
    return "—";
  }
  const left = start ? String(start).slice(0, 10) : "…";
  const right = end ? String(end).slice(0, 10) : "…";
  return `${left} – ${right}`;
}