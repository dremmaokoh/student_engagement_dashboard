import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPassword,
  getRegistrationStatus,
  login,
  me,
  register,
  resetPasswordHandler,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/httpError.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === "test",
  message: {
    error: "Too many requests",
    message: "Too many authentication attempts. Please try again later.",
  },
});

router.get("/registration", getRegistrationStatus);
router.post("/register", authLimiter, asyncHandler(register));
router.post("/login", authLimiter, asyncHandler(login));
router.post("/forgot-password", authLimiter, asyncHandler(forgotPassword));
router.post("/reset-password", authLimiter, asyncHandler(resetPasswordHandler));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
