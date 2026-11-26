import mongoose from "mongoose";

const importBatchSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true },
    fileHash: { type: String, required: true, index: true },
    sourceType: { type: String, default: "csv" },
    status: { type: String, enum: ["previewed", "confirmed"], default: "previewed" },
    monitoringPeriodStart: { type: Date, default: null },
    monitoringPeriodEnd: { type: Date, default: null },
    validCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    importedCount: { type: Number, default: 0 },
    rowErrors: { type: Array, default: [] },
    validRows: { type: Array, default: [] },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

importBatchSchema.index({ courseId: 1, createdAt: -1 });

const ImportBatch = mongoose.models.ImportBatch || mongoose.model("ImportBatch", importBatchSchema);
export default ImportBatch;
