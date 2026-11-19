import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from "../src/config/db.js";
import { env } from "../src/config/env.js";

const app = createApp();

describe("health endpoints", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  test("GET /health returns status and db fields", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(ok|degraded)$/),
        db: expect.stringMatching(/^(connected|disconnected)$/),
      }),
    );
  });

  test("GET /api/v1/health matches GET /health", async () => {
    const [root, prefixed] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/api/v1/health"),
    ]);

    expect(prefixed.status).toBe(200);
    expect(prefixed.body).toEqual(root.body);
  });

  test(
    "reports connected when MongoDB is reachable",
    async () => {
      try {
        await connectDatabase(env.mongodbUri);
      } catch (error) {
        console.warn(
          `Skipping database-connected assertion: MongoDB is not reachable (${error.message}).`,
        );
        return;
      }

      expect(isDatabaseConnected()).toBe(true);

      const response = await request(app).get("/api/v1/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ok",
        db: "connected",
      });
    },
    15000,
  );
});
