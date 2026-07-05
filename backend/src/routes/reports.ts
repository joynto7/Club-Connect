import express from "express";
import { Role } from "@prisma/client";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
import {
  listReports,
  generateReport,
  downloadReport,
  deleteReport,
  generateCertificate,
} from "../controllers/reportController.ts";

const router = express.Router();

const adminOnly = [authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN])];

// UC-10.1 — Report management
router.get("/",                   ...adminOnly, listReports);
router.post("/generate",          ...adminOnly, generateReport);
router.get("/:id/download",       ...adminOnly, downloadReport);
router.delete("/:id",             ...adminOnly, deleteReport);

// U5.8 — Attendance certificate (any authenticated user, own cert only)
router.post("/certificate",       authenticateJWT, generateCertificate);

export default router;
