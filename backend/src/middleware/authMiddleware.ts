import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { accessTokenSecret } from "../lib/jwtSecrets.ts";

/** Attaches req.user if a valid token is present, but never blocks the request. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1] ?? "";
    try {
      const payload = jwt.verify(token, accessTokenSecret) as { userId: string; email: string; role: string };
      req.user = { id: payload.userId, email: payload.email, role: payload.role as any };
    } catch {
      // Invalid token — just ignore, req.user stays undefined
    }
  }
  next();
};

export const authenticateJWT: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.split(" ")[1] ?? "";

  try {
    const payload = jwt.verify(token, accessTokenSecret) as {
      userId: string;
      email: string;
      role: string;
    };

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role as any,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
