import { Router } from "express";
import {
  getCourseClassificationTable,
  getIndicatorWeights,
  getIndicatorWeightVersions,
  postIndicatorWeights,
} from "../controllers/settingsController.js";
import { asyncHandler } from "../utils/httpError.js";

const router = Router();

router.get("/settings/indicator-weights", asyncHandler(getIndicatorWeights));
router.post("/settings/indicator-weights", asyncHandler(postIndicatorWeights));
router.get("/settings/indicator-weights/versions", asyncHandler(getIndicatorWeightVersions));
router.get("/settings/course-classification", asyncHandler(getCourseClassificationTable));

export default router;