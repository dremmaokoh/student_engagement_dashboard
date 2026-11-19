import { getCurrentUser, verifyAccessToken } from "../services/authService.js";
import { HttpError } from "../utils/httpError.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "Authentication required.");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new HttpError(401, "Authentication required.");
    }

    if (!payload?.sub) {
      throw new HttpError(401, "Authentication required.");
    }

    req.user = await getCurrentUser(payload.sub);
    next();
  } catch (error) {
    next(error);
  }
}
