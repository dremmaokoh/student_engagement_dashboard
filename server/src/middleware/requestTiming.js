const SLOW_REQUEST_MS = 300;

export function requestTiming(_req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms >= SLOW_REQUEST_MS) {
      console.warn(
        JSON.stringify({
          level: "warn",
          domain: "http",
          stage: "slow_request",
          method: _req.method,
          path: _req.path,
          status: res.statusCode,
          ms: Math.round(ms),
        }),
      );
    }
  });
  next();
}
