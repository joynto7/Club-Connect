import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { requireCapability } from "../middleware/rbacMiddleware.ts";
import {
  listReports,
  generateReport,
  downloadReport,
  deleteReport,
  generateCertificate,
} from "../controllers/reportController.ts";

const router = express.Router();

const canViewReports = [authenticateJWT, requireCapability("viewReports")];

// UC-10.1 — Report management
router.get("/",                   ...canViewReports, listReports);
router.post("/generate",          ...canViewReports, generateReport);
router.get("/:id/download",       ...canViewReports, downloadReport);
router.delete("/:id",             ...canViewReports, deleteReport);

// U5.8 — Attendance certificate (any authenticated user, own cert only)
router.post("/certificate",       authenticateJWT, generateCertificate);

export default router;
