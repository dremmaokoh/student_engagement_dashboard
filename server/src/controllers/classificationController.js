import {
  exportClassificationResultsCsv,
  generateClassifications,
  getClassificationResult,
  getDashboard,
  listClassificationResults,
  listClassificationRuns,
} from "../services/classification/classificationService.js";
import { sendCsvDownload } from "../utils/csvDownload.js";

export async function postGenerate(req, res) {
  const data = await generateClassifications({
    course: req.course,
    lecturerId: req.user.id,
    input: req.body || {},
  });
  res.status(201).json({ data });
}

export async function getCourseDashboard(req, res) {
  const data = await getDashboard({ course: req.course, query: req.query });
  res.json({ data });
}

export async function getCourseResults(req, res) {
  const results = await listClassificationResults({ course: req.course, query: req.query });
  res.json({ data: results });
}

export async function getCourseRuns(req, res) {
  const data = await listClassificationRuns({ course: req.course, query: req.query });
  res.json({ data });
}

export async function getCourseResult(req, res) {
  const result = await getClassificationResult({
    course: req.course,
    resultId: req.params.resultId,
  });
  res.json({ data: { result } });
}

export async function exportCourseResults(req, res) {
  const csv = await exportClassificationResultsCsv({
    course: req.course,
    query: req.query,
  });
  const code = String(req.course.code || "course").replace(/[^\w.-]+/g, "_");
  sendCsvDownload(res, `${code}-classification-results.csv`, csv);
}
