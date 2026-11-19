import { Router } from "express";
import {
  getAttentionStudents,
  getCourseComparison,
  getSummary,
  getTrend,
} from "../controllers/dashboardController.js";
import { asyncHandler } from "../utils/httpError.js";

const router = Router();

router.get("/summary", asyncHandler(getSummary));
router.get("/course-comparison", asyncHandler(getCourseComparison));
router.get("/attention-students", asyncHandler(getAttentionStudents));
router.get("/trend", asyncHandler(getTrend));

export default router;
