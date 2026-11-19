import mongoose from "mongoose";
import Course from "../models/Course.js";
import { HttpError } from "../utils/httpError.js";

export async function loadOwnedCourse(req, _res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
      throw new HttpError(404, "Course not found.");
    }
    const course = await Course.findOne({
      _id: req.params.courseId,
      lecturerId: req.user.id,
    });
    if (!course) {
      throw new HttpError(404, "Course not found.");
    }
    req.course = course;
    next();
  } catch (error) {
    next(error);
  }
}
