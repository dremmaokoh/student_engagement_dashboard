import crypto from "node:crypto";

function baseContext(extra = {}) {
  return {
    traceId: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...extra,
  };
}

export function logClassificationStage(stage, context = {}) {
  const payload = {
    level: "info",
    domain: "classification",
    stage,
    ...baseContext(context),
  };
  console.info(JSON.stringify(payload));
}

export function logClassificationError(stage, error, context = {}) {
  const payload = {
    level: "error",
    domain: "classification",
    stage,
    message: error?.message || String(error),
    ...baseContext(context),
  };
  console.error(JSON.stringify(payload));
}