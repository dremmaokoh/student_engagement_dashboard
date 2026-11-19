import { Router } from "express";
import {
  getDirectoryStudents,
  getStudentById,
  patchEnrollment,
  patchStudent,
  postStudent,
} from "../controllers/courseController.js";
import {
  getStudentCommunications,
  postStudentCommunication,
} from "../controllers/studentCommunicationController.js";
import { asyncHandler } from "../utils/httpError.js";

const router = Router();

router.get("/students", asyncHandler(getDirectoryStudents));
router.post("/students", asyncHandler(postStudent));
router.get("/students/:studentId/communications", asyncHandler(getStudentCommunications));
router.post("/students/:studentId/communications", asyncHandler(postStudentCommunication));
router.get("/students/:studentId", asyncHandler(getStudentById));
router.patch("/students/:studentId", asyncHandler(patchStudent));
router.patch("/enrollments/:enrollmentId", asyncHandler(patchEnrollment));

export default router;
