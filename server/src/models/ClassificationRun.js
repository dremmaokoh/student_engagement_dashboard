import mongoose from "mongoose";

const countSchema = {
  total: { type: Number, default: 0 },
  ACTIVE: { type: Number, default: 0 },
  REQUIRING_ATTENTION: { type: Number, default: 0 },
  INACTIVE: { type: Number, default: 0 },
  INSUFFICIENT_DATA: { type: Number, default: 0 },
};

const classificationRunSchema = new mongoose.Schema(
  {
    runId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    runName: { type: String, default: null, trim: true, maxlength: 120 },
    generatedAt: { type: Date, required: true },
    configurationVersion: { type: Number, default: null },
    monitoringPeriodStart: { type: Date, required: true },
    monitoringPeriodEnd: { type: Date, required: true },
    classifiedCount: { type: Number, required: true },
    missingActivityCount: { type: Number, default: 0 },
    counts: { type: countSchema, required: true },
  },
  { timestamps: true },
);

classificationRunSchema.index({ courseId: 1, generatedAt: -1 });
classificationRunSchema.index({
  courseId: 1,
  monitoringPeriodStart: 1,
  monitoringPeriodEnd: 1,
  generatedAt: -1,
});

const ClassificationRun =
  mongoose.models.ClassificationRun || mongoose.model("ClassificationRun", classificationRunSchema);

export default ClassificationRun;
