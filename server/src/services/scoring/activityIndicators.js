/**
 * Read current or previously stored activity fields without discarding old records.
 * New names are canonical; legacy names are used only when the new field is absent.
 * Learning Activity Recency uses the latest qualifying timestamp only.
 */
export function resolveActivityMeasures(record = {}) {
  const lastLearningActivityAt =
    record.lastLearningActivityAt !== undefined && record.lastLearningActivityAt !== null
      ? record.lastLearningActivityAt
      : record.lastActivityAt ?? null;
  const learningItemsRequired =
    record.learningItemsRequired !== undefined && record.learningItemsRequired !== null
      ? record.learningItemsRequired
      : record.materialsAvailable ?? null;
  const learningItemsCompleted =
    record.learningItemsCompleted !== undefined && record.learningItemsCompleted !== null
      ? record.learningItemsCompleted
      : record.materialsAccessed ?? null;
  return {
    lastLearningActivityAt: lastLearningActivityAt || null,
    learningItemsRequired,
    learningItemsCompleted,
    assignmentsDue: record.assignmentsDue ?? null,
    assignmentsSubmitted: record.assignmentsSubmitted ?? null,
  };
}
