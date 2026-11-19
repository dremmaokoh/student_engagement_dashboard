import mongoose from "mongoose";

const studentCommunicationSchema = new mongoose.Schema(
  {
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    fromEmail: { type: String, required: true, trim: true, lowercase: true },
    replyToEmail: { type: String, required: true, trim: true, lowercase: true },
    toEmail: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    bodyText: { type: String, required: true, trim: true, maxlength: 20000 },
    status: {
      type: String,
      enum: ["sent", "failed", "not_configured"],
      required: true,
    },
    providerMessageId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

studentCommunicationSchema.index({ studentId: 1, sentAt: -1 });

const StudentCommunication =
  mongoose.models.StudentCommunication ||
  mongoose.model("StudentCommunication", studentCommunicationSchema);

export default StudentCommunication;