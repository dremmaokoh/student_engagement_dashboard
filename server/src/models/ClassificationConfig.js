import mongoose from "mongoose";

const classificationConfigSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    version: { type: Number, required: true },
    isActive: { type: Boolean, default: true, index: true },
    weights: {
      lastActivity: { type: Number, required: true },
      materialAccess: { type: Number, required: true },
      assignmentSubmission: { type: Number, required: true },
    },
    lastActivityBands: { type: Array, required: true },
    classificationBoundaries: {
      requiringAttentionMin: { type: Number, required: true },
      activeMin: { type: Number, required: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changeNote: { type: String, default: "", maxlength: 500 },
    globalWeightsVersionAtSave: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

classificationConfigSchema.index({ courseId: 1, version: 1 }, { unique: true });

const ClassificationConfig =
  mongoose.models.ClassificationConfig ||
  mongoose.model("ClassificationConfig", classificationConfigSchema);

export default ClassificationConfig;
