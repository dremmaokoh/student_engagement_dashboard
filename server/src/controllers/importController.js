import {
  buildCourseActivityCsvTemplate,
  confirmImport,
  getImport,
  listImports,
  previewCsv,
} from "../services/import/importService.js";
import {
  buildCourseRosterCsvTemplate,
  confirmCourseRosterImport,
  previewCourseRosterImport,
} from "../services/import/courseRosterImportService.js";
import {
  buildCourseStudentCsvTemplate,
  confirmCourseStudentImport,
  previewCourseStudentImport,
} from "../services/import/courseStudentImportService.js";
import { sendCsvDownload } from "../utils/csvDownload.js";

export async function downloadTemplate(req, res) {
  const periodStart = String(
    req.query?.periodStart || req.query?.monitoringPeriodStart || "",
  ).trim();
  const periodEnd = String(req.query?.periodEnd || req.query?.monitoringPeriodEnd || "").trim();
  const body = await buildCourseActivityCsvTemplate(req.course._id, { periodStart, periodEnd });
  const code = String(req.course.code || "course").replace(/[^\w.-]+/g, "_");
  sendCsvDownload(res, `${code}-activity-import-template.csv`, body);
}

export async function previewImport(req, res) {
  const data = await previewCsv({
    course: req.course,
    lecturerId: req.user.id,
    file: req.file,
    periodStart: req.body?.monitoringPeriodStart,
    periodEnd: req.body?.monitoringPeriodEnd,
  });
  res.status(201).json({ data });
}

export async function confirmImportHandler(req, res) {
  const data = await confirmImport({
    course: req.course,
    lecturerId: req.user.id,
    importId: req.body?.importId || req.params.importId,
  });
  res.json({ data });
}

export async function listCourseImports(req, res) {
  const items = await listImports(req.course._id);
  res.json({ data: { items } });
}

export async function getCourseImport(req, res) {
  const data = await getImport(req.course._id, req.user.id, req.params.importId);
  res.json({ data });
}

export async function downloadCourseRosterTemplate(req, res) {
  const body = await buildCourseRosterCsvTemplate(req.user.id);
  sendCsvDownload(res, "course-enrolment-template.csv", body);
}

export async function previewCourseRoster(req, res) {
  const data = previewCourseRosterImport(req.user.id, req.file?.buffer, req.file?.originalname);
  res.status(201).json({ data });
}

export async function confirmCourseRoster(req, res) {
  const data = await confirmCourseRosterImport(req.user.id, req.body?.importId);
  res.json({ data });
}

export async function downloadCourseStudentTemplate(req, res) {
  const body = buildCourseStudentCsvTemplate(req.course);
  sendCsvDownload(res, `${String(req.course.code || "course").replace(/[^\w.-]+/g, "_")}-students-template.csv`, body);
}

export async function previewCourseStudents(req, res) {
  const data = await previewCourseStudentImport(
    req.user.id,
    req.course._id,
    req.file?.buffer,
    req.file?.originalname,
  );
  res.status(201).json({ data });
}

export async function confirmCourseStudents(req, res) {
  const data = await confirmCourseStudentImport(req.user.id, req.course._id, req.body?.importId);
  res.json({ data });
}
