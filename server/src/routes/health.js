import { Router } from "express";
import { getDatabaseStatus } from "../config/db.js";
import { isMailConfigured, mailTransportMode } from "../services/mailService.js";

const router = Router();

function healthPayload() {
  const db = getDatabaseStatus();
  return {
    status: db === "connected" ? "ok" : "degraded",
    db,
    mail: isMailConfigured() ? mailTransportMode() : "not_configured",
  };
}

router.get("/", (_req, res) => {
  res.json(healthPayload());
});

export default router;
export { healthPayload };
