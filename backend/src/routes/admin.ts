import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { requireCapability } from "../middleware/rbacMiddleware.ts";
import {
  getAdminStats,
  getSystemMonitor,
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

const canViewDashboardStats = [authenticateJWT, requireCapability("viewDashboardStats")];
const canApproveClubs       = [authenticateJWT, requireCapability("approveClubs")];
const canApproveEvents      = [authenticateJWT, requireCapability("approveEvents")];
const canViewContentReports = [authenticateJWT, requireCapability("viewContentReports")];
const canViewAnalytics      = [authenticateJWT, requireCapability("viewAnalytics")];
const canManageUsers        = [authenticateJWT, requireCapability("manageUsers")];
const canViewSettings       = [authenticateJWT, requireCapability("viewSettings")];
const canViewAuditLog       = [authenticateJWT, requireCapability("viewAuditLog")];
const canViewSystemMonitor  = [authenticateJWT, requireCapability("viewSystemMonitor")];

// Stats & analytics
router.get("/stats",     ...canViewDashboardStats, getAdminStats);
router.get("/analytics", ...canViewAnalytics, getAdminAnalytics);

// UC-7.1 / UC-7.2 — User management (System Admin only)
router.get("/users",               ...canManageUsers, listAdminUsers);
router.put("/users/:id/suspend",   ...canManageUsers, suspendUser);
router.put("/users/:id/activate",  ...canManageUsers, activateUser);
router.put("/users/:id/role",      ...canManageUsers, changeUserRole);

// UC-7.3 — Club oversight
router.get("/clubs",  ...canApproveClubs, listAdminClubs);

// UC-7.4 — Event oversight
router.get("/events", ...canApproveEvents, listAdminEvents);

// UC-7.5 — Content moderation
router.get("/content-reports",              ...canViewContentReports, listContentReports);
router.put("/content-reports/:id/resolve",  ...canViewContentReports, resolveContentReport);
router.put("/content-reports/:id/dismiss",  ...canViewContentReports, dismissContentReport);

// UC-7.6 — System settings (System Admin only)
router.get("/settings",    ...canViewSettings, getSystemSettings);
router.put("/settings",    ...canViewSettings, upsertSystemSetting);

// U10.2 — Audit log (System Admin only)
router.get("/audit-log",   ...canViewAuditLog, getAuditLog);

// System Monitor (System Admin only)
router.get("/system-monitor", ...canViewSystemMonitor, getSystemMonitor);

// U10.4 — Bulk operations
router.post("/clubs/bulk-approve",   ...canApproveClubs, bulkApproveClubs);
router.post("/events/bulk-approve",  ...canApproveEvents, bulkApproveEvents);
router.post("/users/bulk-suspend",   ...canManageUsers, bulkSuspendUsers);

// U10 — Email digest (any logged-in user)
router.get("/email-digest",  authenticateJWT, getEmailDigestSub);
router.put("/email-digest",  authenticateJWT, upsertEmailDigestSub);

export default router;
