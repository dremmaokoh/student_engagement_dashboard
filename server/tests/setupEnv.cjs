process.env.NODE_ENV = "test";

// Keep tests hermetic: dotenv does not override keys already present in
// process.env, so these empty values prevent mail credentials in a developer's
// server/.env from being loaded into the test environment.
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.RESEND_API_KEY = "";
