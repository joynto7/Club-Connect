import express from "express";
import { Role } from "@prisma/client";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
import {
  getAdminStats,
  listAdminUsers,
  suspendUser,
  activateUser,
  changeUserRole,
  listAdminClubs,
  listAdminEvents,
  listContentReports,
  resolveContentReport,
  dismissContentReport,
  getSystemSettings,
  upsertSystemSetting,
  getAuditLog,
  bulkApproveClubs,
  bulkApproveEvents,
  bulkSuspendUsers,
  getEmailDigestSub,
  upsertEmailDigestSub,
} from "../controllers/adminController.ts";
import { getAdminAnalytics } from "../controllers/analyticsController.ts";

const router = express.Router();

const adminOnly = [authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN])];

// Stats & analytics
router.get("/stats",     ...adminOnly, getAdminStats);
router.get("/analytics", ...adminOnly, getAdminAnalytics);

// UC-7.1 / UC-7.2 — User management
router.get("/users",               ...adminOnly, listAdminUsers);
router.put("/users/:id/suspend",   ...adminOnly, suspendUser);
router.put("/users/:id/activate",  ...adminOnly, activateUser);
router.put("/users/:id/role",      ...adminOnly, changeUserRole);

// UC-7.3 — Club oversight
router.get("/clubs",  ...adminOnly, listAdminClubs);

// UC-7.4 — Event oversight
router.get("/events", ...adminOnly, listAdminEvents);

// UC-7.5 — Content moderation
router.get("/content-reports",              ...adminOnly, listContentReports);
router.put("/content-reports/:id/resolve",  ...adminOnly, resolveContentReport);
router.put("/content-reports/:id/dismiss",  ...adminOnly, dismissContentReport);

// UC-7.6 — System settings
router.get("/settings",    ...adminOnly, getSystemSettings);
router.put("/settings",    ...adminOnly, upsertSystemSetting);

// U10.2 — Audit log
router.get("/audit-log",   ...adminOnly, getAuditLog);

// U10.4 — Bulk operations
router.post("/clubs/bulk-approve",   ...adminOnly, bulkApproveClubs);
router.post("/events/bulk-approve",  ...adminOnly, bulkApproveEvents);
router.post("/users/bulk-suspend",   ...adminOnly, bulkSuspendUsers);

// U10 — Email digest (any logged-in user)
router.get("/email-digest",  authenticateJWT, getEmailDigestSub);
router.put("/email-digest",  authenticateJWT, upsertEmailDigestSub);

export default router;
