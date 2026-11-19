import mongoose from "mongoose";

const activityRecordSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    monitoringPeriodStart: { type: Date, required: true },
    monitoringPeriodEnd: { type: Date, required: true },
    lastActivityAt: { type: Date, default: null },
    materialsAvailable: { type: Number, default: null },
    materialsAccessed: { type: Number, default: null },
    assignmentsDue: { type: Number, default: null },
    assignmentsSubmitted: { type: Number, default: null },
    importBatchId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportBatch", required: true },
    sourceType: { type: String, default: "csv" },
    validation: { type: Object, default: {} },
  },
  { timestamps: true },
);

activityRecordSchema.index(
  { courseId: 1, studentId: 1, monitoringPeriodStart: 1, monitoringPeriodEnd: 1 },
  { unique: true },
);

const ActivityRecord =
  mongoose.models.ActivityRecord || mongoose.model("ActivityRecord", activityRecordSchema);
export default ActivityRecord;
