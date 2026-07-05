import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";

export const requireRole = (allowedRoles: Role[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }

    next();
  };
};
