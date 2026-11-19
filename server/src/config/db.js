import mongoose from "mongoose";

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseStatus() {
  return isDatabaseConnected() ? "connected" : "disconnected";
}

export async function ensureDatabase(uri) {
  if (isDatabaseConnected()) {
    return mongoose.connection;
  }
  return connectDatabase(uri);
}

export async function connectDatabase(uri) {
  mongoose.set("strictQuery", true);

  if (isDatabaseConnected()) {
    return mongoose.connection;
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}