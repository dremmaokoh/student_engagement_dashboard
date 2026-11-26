import mongoose from "mongoose";

const lecturerIndicatorWeightsSchema = new mongoose.Schema(
  {
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    version: { type: Number, required: true },
    isActive: { type: Boolean, default: true, index: true },
    weights: {
      lastActivity: { type: Number, required: true },
      materialAccess: { type: Number, required: true },
      assignmentSubmission: { type: Number, required: true },
    },
    activeIndicators: {
      lastActivity: { type: Boolean, default: true },
      materialAccess: { type: Boolean, default: true },
      assignmentSubmission: { type: Boolean, default: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changeNote: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

lecturerIndicatorWeightsSchema.index({ lecturerId: 1, version: 1 }, { unique: true });

const LecturerIndicatorWeights =
  mongoose.models.LecturerIndicatorWeights ||
  mongoose.model("LecturerIndicatorWeights", lecturerIndicatorWeightsSchema);

export default LecturerIndicatorWeights;