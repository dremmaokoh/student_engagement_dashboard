import mongoose from "mongoose";

const classificationResultSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    activityRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityRecord", default: null },
    runId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    runName: { type: String, default: null, trim: true, maxlength: 120 },
    monitoringPeriodStart: { type: Date, required: true },
    monitoringPeriodEnd: { type: Date, required: true },
    indicators: { type: Object, required: true },
    configuredWeights: { type: Object, required: true },
    effectiveWeights: { type: Object, required: true },
    overallScore: { type: Number, default: null },
    displayScore: { type: Number, default: null },
    classification: { type: String, required: true, index: true },
    noClassifiableActivity: { type: Boolean, default: false },
    configurationId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassificationConfig", required: true },
    configurationVersion: { type: Number, required: true },
    configurationSnapshot: { type: Object, required: true },
    explanation: { type: Object, required: true },
    activitySnapshot: { type: Object, default: null },
    generatedAt: { type: Date, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

classificationResultSchema.index({
  courseId: 1,
  monitoringPeriodStart: 1,
  monitoringPeriodEnd: 1,
  classification: 1,
});
classificationResultSchema.index({
  studentId: 1,
  courseId: 1,
  monitoringPeriodStart: 1,
  monitoringPeriodEnd: 1,
  generatedAt: -1,
});
classificationResultSchema.index({ courseId: 1, runId: 1 });

const ClassificationResult =
  mongoose.models.ClassificationResult ||
  mongoose.model("ClassificationResult", classificationResultSchema);

export default ClassificationResult;
