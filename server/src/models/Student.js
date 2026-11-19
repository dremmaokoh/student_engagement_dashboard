import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    matriculationNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, default: null },
  },
  { timestamps: true },
);

studentSchema.index({ matriculationNumber: 1 }, { unique: true });

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);
export default Student;
