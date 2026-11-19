import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { createApp } from "./app.js";

const app = createApp();

async function start() {
  try {
    await connectDatabase(env.mongodbUri);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.name, error.message);
    console.error(
      "API routes will return 503 until MongoDB is reachable. For Atlas: Network Access → add your IP (or 0.0.0.0/0 for dev).",
    );
    console.error("For local dev: start Mongo (docker compose up -d) and set MONGODB_URI=mongodb://127.0.0.1:27017/student_engagement in server/.env");
  }

  const port = env.port;
  app.listen(port, "0.0.0.0", () => {
    console.log(`API listening on 0.0.0.0:${port}`);
  });
}

start();
