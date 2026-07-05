import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { getFeed } from "../controllers/feedController.ts";

const router = express.Router();

router.get("/", authenticateJWT, getFeed);

export default router;
