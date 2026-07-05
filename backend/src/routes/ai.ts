import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { generateEventDescription } from "../controllers/aiController.ts";

const router = express.Router();

// U7.1 — AI event description assistant (streaming SSE)
router.post("/event-description", authenticateJWT, generateEventDescription);

export default router;
