import express from "express";
import { globalSearch, getRecommendations } from "../controllers/searchController.ts";
import { optionalAuth, authenticateJWT } from "../middleware/authMiddleware.ts";

const router = express.Router();

// GET /search?q=&type=all|clubs|events|announcements
router.get("/", optionalAuth, globalSearch);

// GET /search/recommendations — personalized events for logged-in user
router.get("/recommendations", authenticateJWT, getRecommendations);

export default router;
