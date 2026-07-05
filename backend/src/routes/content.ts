import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { submitContentReport } from "../controllers/contentController.ts";

const router = express.Router();

// UC-11.3 — Any authenticated user can file a content report
router.post("/report", authenticateJWT, submitContentReport);

export default router;
