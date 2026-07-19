import type { RequestHandler } from "express";
import { Role } from "@prisma/client";

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

export const ROLE_CAPABILITIES = {
  viewDashboardStats: [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  approveClubs:       [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  approveEvents:      [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  viewContentReports: [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  viewAnalytics:      [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  viewReports:        [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  manageUsers:        [Role.SYSTEM_ADMIN],
  viewSettings:       [Role.SYSTEM_ADMIN],
  viewAuditLog:       [Role.SYSTEM_ADMIN],
  viewSystemMonitor:  [Role.SYSTEM_ADMIN],
} as const satisfies Record<string, Role[]>;

export type Capability = keyof typeof ROLE_CAPABILITIES;

export const requireCapability = (capability: Capability): RequestHandler =>
  requireRole(ROLE_CAPABILITIES[capability] as Role[]);
