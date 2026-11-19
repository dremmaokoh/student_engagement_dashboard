import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(_req, res) {
  res.status(404).json({
    error: "Not found",
    message: "This API route is not available.",
  });
}

function isDatabaseError(err) {
  return (
    err.name === "MongooseServerSelectionError" ||
    err.name === "MongoServerSelectionError" ||
    err.name === "MongoNetworkError" ||
    (typeof err.message === "string" && err.message.includes("buffering timed out"))
  );
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.status === 401 ? "Unauthorized" : err.message,
      message: err.message,
      ...err.extra,
    });
  }

  if (isDatabaseError(err)) {
    return res.status(503).json({
      error: "Database unavailable",
      message:
        "The database is not connected. Check MongoDB Atlas network access (IP allowlist) and MONGODB_URI, then restart the API.",
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation error",
      message: "The request body is invalid.",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: "Conflict",
      message: "A record with those unique fields already exists.",
    });
  }

  if (err.name === "MulterError") {
    return res.status(400).json({
      error: "Upload error",
      message: err.code === "LIMIT_FILE_SIZE" ? "CSV files must be 2MB or smaller." : err.message,
    });
  }

  if (err.name === "CastError") {
    return res.status(404).json({
      error: "Not found",
      message: "The requested record was not found.",
    });
  }

  const status = err.status || 500;
  return res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
    message: env.nodeEnv === "production" || status === 500 ? "Something went wrong." : err.message,
  });
}
