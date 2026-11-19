import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, isProduction } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { ensureDatabaseConnectionMiddleware } from "./middleware/ensureDatabaseConnection.js";
import { requireAuth } from "./middleware/requireAuth.js";
import authRouter from "./routes/auth.js";
import coursesRouter from "./routes/courses.js";
import dashboardRouter from "./routes/dashboard.js";
import docsRouter from "./routes/docs.js";
import healthRouter from "./routes/health.js";
import settingsRouter from "./routes/settings.js";
import studentsRouter from "./routes/students.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigin,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/health", healthRouter);
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1", docsRouter);
  app.use("/api/v1/auth", authRouter);

  app.use("/api/v1", requireAuth);
  app.use("/api/v1", ensureDatabaseConnectionMiddleware);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1", settingsRouter);
  app.use("/api/v1", studentsRouter);
  app.use("/api/v1", notFoundHandler);

  if (isProduction()) {
    const serverSrcDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.join(path.resolve(serverSrcDir, "../.."), "client", "dist");
    app.use(express.static(clientDist, { index: false }));
    app.get(/^(?!\/api\/|\/health).*/, (_req, res, next) => {
      res.sendFile(path.join(clientDist, "index.html"), (err) => {
        if (err) {
          next(err);
        }
      });
    });
  }

  app.use(errorHandler);

  return app;
}
