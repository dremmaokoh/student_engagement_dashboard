function dateLabel(value) {
  if (!value) {
    return null;
  }
  return String(value).slice(0, 10);
}

export function buildDashboardInsights(summary, comparison) {
  const insights = [];
  if (!summary || summary.state === "no_courses") {
    return insights;
  }

  const counts = summary.counts || {};
  const total = counts.total || 0;

  if (total > 0 && counts.INSUFFICIENT_DATA > 0) {
    const pct = summary.percentages?.INSUFFICIENT_DATA;
    insights.push(
      `${counts.INSUFFICIENT_DATA} course enrolment${counts.INSUFFICIENT_DATA === 1 ? "" : "s"} (${pct ?? "—"}%) ` +
        "have insufficient data for this monitoring period.",
    );
  }

  const items = (comparison?.items || []).filter((item) => item.hasClassification);
  if (items.length > 0 && items[0].attentionCount > 0) {
    const top = items[0];
    insights.push(
      `${top.course.code} has the highest follow-up count in this period (${top.attentionCount} inactive or requiring attention).`,
    );
  }

  if (items.length > 1) {
    let peakInactive = items[0];
    for (const item of items) {
      if ((item.percentages?.INACTIVE || 0) > (peakInactive.percentages?.INACTIVE || 0)) {
        peakInactive = item;
      }
    }
    const inactivePct = peakInactive.percentages?.INACTIVE;
    if (inactivePct > 0) {
      insights.push(
        `${peakInactive.course.code} has the largest share of inactive enrolments (${inactivePct}%).`,
      );
    }
  }

  if (summary.latestImport) {
    const when = dateLabel(summary.latestImport.confirmedAt);
    insights.push(
      `Activity data was imported from ${summary.latestImport.filename} for ${summary.latestImport.course?.code}` +
        (when ? ` on ${when}` : "") +
        ` (${summary.latestImport.importedCount} records accepted).`,
    );
  }

  return insights.slice(0, 4);
}