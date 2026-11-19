import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(serverRoot, "..");

dotenv.config({ path: path.join(serverRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env") });

function readEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

function defaultClientOrigin() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    return renderUrl;
  }
  return "http://localhost:5173";
}

export const env = {
  nodeEnv: readEnv("NODE_ENV", "development"),
  port: Number(readEnv("PORT", "5000")),
  mongodbUri: readEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/student_engagement"),
  clientOrigin: readEnv("CLIENT_ORIGIN", defaultClientOrigin()),
  jwtSecret: readEnv("JWT_SECRET", ""),
  jwtExpiresIn: readEnv("JWT_EXPIRES_IN", "8h"),
  authRegisterEnabled: readEnv("AUTH_REGISTER_ENABLED", "true") !== "false",
  smtpHost: readEnv("SMTP_HOST", ""),
  smtpPort: Number(readEnv("SMTP_PORT", "587")),
  smtpUser: readEnv("SMTP_USER", ""),
  smtpPass: readEnv("SMTP_PASS", "").replace(/\s+/g, ""),
  mailFrom: readEnv("MAIL_FROM", "Student Engagement Dashboard <noreply@localhost>"),
};

export function isProduction() {
  return env.nodeEnv === "production";
}
