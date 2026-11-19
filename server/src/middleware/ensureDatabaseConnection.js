import { env } from "../config/env.js";
import { ensureDatabase, isDatabaseConnected } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";

const DB_UNAVAILABLE_MESSAGE =
  "The database is not connected. Check MongoDB Atlas network access (IP allowlist) and MONGODB_URI, then restart the API.";

export async function ensureDatabaseConnection() {
  if (!isDatabaseConnected()) {
    try {
      await ensureDatabase(env.mongodbUri);
    } catch {
      throw new HttpError(503, DB_UNAVAILABLE_MESSAGE);
    }
  }
  if (!isDatabaseConnected()) {
    throw new HttpError(503, DB_UNAVAILABLE_MESSAGE);
  }
}

export async function ensureDatabaseConnectionMiddleware(_req, _res, next) {
  try {
    await ensureDatabaseConnection();
    next();
  } catch (error) {
    next(error);
  }
}