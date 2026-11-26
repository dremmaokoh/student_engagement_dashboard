import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import ActivityRecord from "../src/models/ActivityRecord.js";
import ClassificationConfig from "../src/models/ClassificationConfig.js";
import ClassificationResult from "../src/models/ClassificationResult.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import ImportBatch from "../src/models/ImportBatch.js";
import LecturerIndicatorWeights from "../src/models/LecturerIndicatorWeights.js";
import Student from "../src/models/Student.js";
import StudentCommunication from "../src/models/StudentCommunication.js";
import User from "../src/models/User.js";

const models = [
  ActivityRecord,
  ClassificationConfig,
  ClassificationResult,
  Course,
  Enrollment,
  ImportBatch,
  LecturerIndicatorWeights,
  Student,
  StudentCommunication,
  User,
];

async function main() {
  await connectDatabase(env.mongodbUri);
  for (const model of models) {
    await model.syncIndexes();
    console.log(`Indexes synced: ${model.modelName}`);
  }
  await disconnectDatabase();
}

main().catch((error) => {
  console.error("Index sync failed:", error.message);
  process.exitCode = 1;
});
