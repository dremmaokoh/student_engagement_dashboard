import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    description: { type: String, trim: true, default: "", maxlength: 2000 },
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true },
);

courseSchema.index({ lecturerId: 1, code: 1 }, { unique: true });

const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);
export default Course;
