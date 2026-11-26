/**
 * Column descriptors for structural skeletons.
 *
 * Each entry mirrors the real table header below it: the same class names are
 * applied to the skeleton `<th>`/`<td>`, and `width` is used only in a
 * `<colgroup>` so the placeholder and the loaded table share the same column
 * proportions and responsive behaviour.
 */
const column = (className, width, barWidths = ["80%", "65%", "72%", "58%"]) => ({
  className,
  width,
  barWidths,
});

export const SKELETON_COLUMNS = {
  legacyCourses: [
    column("col-serial", "56px", ["70%"]),
    column("", "14%"),
    column("", "46%"),
    column("students-col-action", "20%"),
  ],
  courses: [
    column("col-serial", "56px", ["70%"]),
    column("courses-col-code", "15%"),
    column("courses-col-name", "32%"),
    column("courses-col-students", "12%"),
    column("courses-col-status", "25%"),
    column("students-col-action", "16%"),
  ],
  students: [
    column("col-serial", "56px", ["70%"]),
    { ...column("students-col-name", "24%", ["82%", "68%", "76%", "62%"]), avatar: true, lines: 2 },
    column("", "13%"),
    column("", "22%"),
    column("", "25%"),
    column("students-col-action", "16%"),
  ],
  roster: [
    column("col-serial", "56px", ["70%"]),
    column("students-col-name", "25%", ["80%", "70%", "76%", "64%"]),
    column("course-overview-col-id", "14%"),
    column("course-overview-col-score", "16%"),
    column("", "24%"),
    column("students-col-action", "15%"),
  ],
  attention: [
    column("col-serial", "56px", ["70%"]),
    column("students-col-name", "25%", ["80%", "70%", "76%", "64%"]),
    column("course-overview-col-id", "14%"),
    column("course-overview-col-score", "16%"),
    column("", "25%"),
    column("students-col-action", "14%"),
  ],
  dashboardQueue: [
    column("col-serial", "56px", ["70%"]),
    column("", "17%", ["82%", "68%", "76%", "62%"]),
    column("", "11%"),
    { ...column("", "16%", ["72%", "84%", "66%", "78%"]), lines: 2 },
    column("", "12%"),
    column("", "15%"),
    column("", "13%"),
    column("students-col-action", "14%"),
  ],
  runHistory: [
    column("col-serial", "56px", ["70%"]),
    column("course-results-run-name-cell", "16%", ["82%", "68%", "76%", "62%"]),
    column("", "12%"),
    column("", "13%"),
    column("", "7%"),
    column("", "7%"),
    column("", "7%"),
    column("", "10%"),
    column("", "7%"),
    column("", "10%"),
    column("students-col-action", "8%"),
  ],
  results: [
    column("col-serial", "56px", ["70%"]),
    column("", "34%", ["82%", "68%", "76%", "62%"]),
    column("", "16%"),
    column("", "24%"),
    column("students-col-action", "18%"),
  ],
  messages: [
    column("col-serial", "56px", ["70%"]),
    column("", "18%"),
    column("", "32%", ["82%", "68%", "76%", "62%"]),
    column("", "12%"),
    column("", "14%"),
    column("students-col-action", "12%"),
  ],
  courseParticipation: [
    column("col-serial", "56px", ["70%"]),
    { ...column("", "24%", ["72%", "84%", "66%", "78%"]), lines: 2 },
    column("", "22%"),
    column("", "12%"),
    column("", "24%"),
    column("students-col-action", "12%"),
  ],
  settingsCourses: [
    column("col-serial", "56px", ["70%"]),
    column("", "18%"),
    column("", "34%"),
    column("", "26%"),
    column("students-col-action", "12%"),
  ],
  importErrors: [
    column("col-serial", "56px", ["70%"]),
    column("", "14%"),
    column("", "24%"),
    column("", "52%"),
  ],
  importHistory: [
    column("col-serial", "56px", ["70%"]),
    column("", "28%"),
    column("", "14%"),
    column("", "10%"),
    column("", "10%"),
    column("", "10%"),
    column("", "10%"),
  ],
  bands: [
    column("col-serial", "56px", ["70%"]),
    column("", "24%"),
    column("", "28%"),
    column("", "24%"),
  ],
  boundaries: [
    column("col-serial", "56px", ["70%"]),
    column("", "42%"),
    column("", "34%"),
  ],
  versionHistory: [
    column("col-serial", "56px", ["70%"]),
    column("", "14%"),
    column("", "10%"),
    column("", "20%"),
    column("", "18%"),
    column("", "24%"),
  ],
  resultBreakdown: [
    column("col-serial", "56px", ["70%"]),
    column("", "34%"),
    column("", "20%"),
    column("", "16%"),
    column("", "22%"),
  ],
};

export function skeletonColumns(name) {
  return SKELETON_COLUMNS[name] || [];
}
