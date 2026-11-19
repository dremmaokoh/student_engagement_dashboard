import { Router } from "express";
import {
  deleteCourse,
  getCourse,
  getCourses,
  getCourseStudents,
  patchCourse,
  postCourse,
  postEnrollment,
} from "../controllers/courseController.js";
import {
  exportCourseResults,
  getCourseDashboard,
  getCourseResult,
  getCourseResults,
  getCourseRuns,
  postGenerate,
} from "../controllers/classificationController.js";
import {
  getClassificationConfig,
  getClassificationConfigVersions,
  postClassificationConfig,
} from "../controllers/configController.js";
import {
  confirmCourseRoster,
  confirmImportHandler,
  downloadCourseRosterTemplate,
  downloadTemplate,
  getCourseImport,
  listCourseImports,
  previewCourseRoster,
  previewImport,
} from "../controllers/importController.js";
import { loadOwnedCourse } from "../middleware/loadOwnedCourse.js";
import { uploadCsv } from "../middleware/uploadCsv.js";
import { asyncHandler } from "../utils/httpError.js";

const router = Router();

router.get("/", asyncHandler(getCourses));
router.post("/", asyncHandler(postCourse));
router.get("/import-roster/template", asyncHandler(downloadCourseRosterTemplate));
router.post("/import-roster/preview", uploadCsv, asyncHandler(previewCourseRoster));
router.post("/import-roster/confirm", asyncHandler(confirmCourseRoster));
router.get("/:courseId/students", loadOwnedCourse, asyncHandler(getCourseStudents));
router.post("/:courseId/enrollments", loadOwnedCourse, asyncHandler(postEnrollment));
router.get("/:courseId/imports/template", loadOwnedCourse, asyncHandler(downloadTemplate));
router.post("/:courseId/imports/preview", loadOwnedCourse, uploadCsv, asyncHandler(previewImport));
router.post("/:courseId/imports/confirm", loadOwnedCourse, asyncHandler(confirmImportHandler));
router.get("/:courseId/imports/:importId", loadOwnedCourse, asyncHandler(getCourseImport));
router.get("/:courseId/imports", loadOwnedCourse, asyncHandler(listCourseImports));
router.get(
  "/:courseId/classification-config/versions",
  loadOwnedCourse,
  asyncHandler(getClassificationConfigVersions),
);
router.get("/:courseId/classification-config", loadOwnedCourse, asyncHandler(getClassificationConfig));
router.post("/:courseId/classification-config", loadOwnedCourse, asyncHandler(postClassificationConfig));
router.post("/:courseId/classifications/generate", loadOwnedCourse, asyncHandler(postGenerate));
router.get("/:courseId/dashboard", loadOwnedCourse, asyncHandler(getCourseDashboard));
router.get("/:courseId/classification-runs", loadOwnedCourse, asyncHandler(getCourseRuns));
router.get("/:courseId/classification-results/export", loadOwnedCourse, asyncHandler(exportCourseResults));
router.get("/:courseId/classification-results/:resultId", loadOwnedCourse, asyncHandler(getCourseResult));
router.get("/:courseId/classification-results", loadOwnedCourse, asyncHandler(getCourseResults));
router.get("/:courseId", loadOwnedCourse, asyncHandler(getCourse));
router.patch("/:courseId", loadOwnedCourse, asyncHandler(patchCourse));
router.delete("/:courseId", loadOwnedCourse, asyncHandler(deleteCourse));

export default router;
