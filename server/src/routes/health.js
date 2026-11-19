import { Router } from "express";
import { getDatabaseStatus } from "../config/db.js";

const router = Router();

function healthPayload() {
  const db = getDatabaseStatus();
  return {
    status: db === "connected" ? "ok" : "degraded",
    db,
  };
}

router.get("/", (_req, res) => {
  res.json(healthPayload());
});

export default router;
export { healthPayload };
