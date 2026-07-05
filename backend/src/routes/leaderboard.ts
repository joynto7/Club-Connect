import express from "express";
import { optionalAuth } from "../middleware/authMiddleware.ts";
import { getLeaderboard, getSemesterLeaderboard } from "../controllers/leaderboardController.ts";

const router = express.Router();

router.get("/",          optionalAuth, getLeaderboard);
router.get("/semester",  optionalAuth, getSemesterLeaderboard);

export default router;
