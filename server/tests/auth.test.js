import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import User from "../src/models/User.js";

const app = createApp();
const TEST_EMAIL_PREFIX = "phase1-test-";

function uniqueEmail() {
  return `${TEST_EMAIL_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

describe("authentication", () => {
  beforeAll(async () => {
    await connectDatabase(env.mongodbUri);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } });
    await disconnectDatabase();
  });

  test("rejects unauthenticated access to private API routes", async () => {
    const response = await request(app).get("/api/v1/courses");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required.");
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);
  });

  test("rejects an invalid bearer token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
  });

  test("registers a lecturer, returns a token, and never exposes the password hash", async () => {
    const email = uniqueEmail();
    const response = await request(app).post("/api/v1/auth/register").send({
      fullName: "Test Lecturer",
      email,
      password: "securePass1",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        fullName: "Test Lecturer",
        email,
        role: "lecturer",
      }),
    );
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);
  });

  test("prevents duplicate registration", async () => {
    const email = uniqueEmail();
    const payload = {
      fullName: "Duplicate Lecturer",
      email,
      password: "securePass1",
    };

    await request(app).post("/api/v1/auth/register").send(payload);
    const response = await request(app).post("/api/v1/auth/register").send(payload);

    expect(response.status).toBe(409);
  });

  test("rejects invalid registration payloads", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      fullName: "A",
      email: "not-an-email",
      password: "short",
    });

    expect(response.status).toBe(400);
  });

  test("logs in with valid credentials and serves /auth/me", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Login Lecturer",
      email,
      password: "securePass1",
    });

    const login = await request(app).post("/api/v1/auth/login").send({
      email,
      password: "securePass1",
    });

    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email);
    expect(me.body.data.user.passwordHash).toBeUndefined();
  });

  test("rejects invalid login credentials with a generic message", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: uniqueEmail(),
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password.");
  });

  test("forgot-password uses a generic message for unknown emails", async () => {
    const response = await request(app).post("/api/v1/auth/forgot-password").send({
      email: uniqueEmail(),
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toMatch(/if that email is registered/i);
    expect(response.body.data.resetUrl).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);
  });

  test("resets a password with a one-time token and blocks the old password", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Reset Lecturer",
      email,
      password: "oldPass123",
    });

    const forgot = await request(app).post("/api/v1/auth/forgot-password").send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data.resetUrl).toEqual(expect.stringContaining("/reset-password?token="));

    const token = new URL(forgot.body.data.resetUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await request(app).post("/api/v1/auth/reset-password").send({
      token,
      password: "newPass123",
    });
    expect(reset.status).toBe(200);

    const reuse = await request(app).post("/api/v1/auth/reset-password").send({
      token,
      password: "anotherPass1",
    });
    expect(reuse.status).toBe(400);

    const oldLogin = await request(app).post("/api/v1/auth/login").send({
      email,
      password: "oldPass123",
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/v1/auth/login").send({
      email,
      password: "newPass123",
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.token).toEqual(expect.any(String));
  });

  test("rejects an invalid reset token", async () => {
    const response = await request(app).post("/api/v1/auth/reset-password").send({
      token: "not-a-real-token",
      password: "newPass123",
    });
    expect(response.status).toBe(400);
  });

  test("health remains public", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        db: expect.stringMatching(/^(connected|disconnected)$/),
      }),
    );
  });
});
