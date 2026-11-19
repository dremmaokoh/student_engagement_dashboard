import {
  getDashboardAttentionStudents,
  getDashboardCourseComparison,
  getDashboardSummary,
  getDashboardTrend,
} from "../services/dashboardService.js";

export async function getSummary(req, res) {
  const data = await getDashboardSummary(req.user.id, req.query);
  res.json({ data });
}

export async function getCourseComparison(req, res) {
  const data = await getDashboardCourseComparison(req.user.id, req.query);
  res.json({ data });
}

export async function getAttentionStudents(req, res) {
  const data = await getDashboardAttentionStudents(req.user.id, req.query);
  res.json({ data });
}

export async function getTrend(req, res) {
  const data = await getDashboardTrend(req.user.id, req.query);
  res.json({ data });
}
