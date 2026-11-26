import request from "supertest";
import { createApp } from "../src/app.js";
import { openApiSpec } from "../src/docs/openapi.js";

const app = createApp();

const requiredPaths = [
  "/health",
  "/auth/login",
  "/courses",
  "/courses/{courseId}/imports/preview",
  "/settings/indicator-weights",
  "/settings/indicator-weights/versions",
  "/courses/{courseId}/classification-config",
  "/courses/{courseId}/classifications/generate",
  "/courses/{courseId}/dashboard",
  "/courses/{courseId}/classification-runs",
  "/courses/{courseId}/classification-results/{resultId}",
  "/dashboard/summary",
  "/dashboard/course-comparison",
  "/dashboard/attention-students",
  "/dashboard/trend",
];

describe("OpenAPI documentation", () => {
  test("serves the OpenAPI document without authentication", async () => {
    const response = await request(app).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.info.title).toMatch(/student engagement/i);
    for (const path of requiredPaths) {
      expect(response.body.paths).toHaveProperty(path);
    }
  });

  test("spec in code matches the served document", () => {
    expect(Object.keys(openApiSpec.paths)).toEqual(
      expect.arrayContaining(requiredPaths),
    );
  });

  test("Swagger UI is available without authentication", async () => {
    const response = await request(app).get("/api/v1/docs/");
    expect(response.status).toBe(200);
    expect(String(response.text)).toMatch(/swagger/i);
  });
});
