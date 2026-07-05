import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import {
  getMyProfile,
  updateMyProfile,
  getMyHistory,
  getMyClubs,
  getNotificationPreferences,
  updateNotificationPreferences,
  listUsers,
  getUserProfile,
  getMyPoints,
  getMyAchievements,
  subscribePush,
  unsubscribePush,
} from "../controllers/userController.ts";

const router = express.Router();

router.get("/me",                          authenticateJWT, getMyProfile);
router.put("/me",                          authenticateJWT, updateMyProfile);
router.get("/me/history",                  authenticateJWT, getMyHistory);
router.get("/me/clubs",                    authenticateJWT, getMyClubs);
router.get("/me/notification-preferences", authenticateJWT, getNotificationPreferences);
router.put("/me/notification-preferences", authenticateJWT, updateNotificationPreferences);
router.get("/me/points",       authenticateJWT, getMyPoints);
router.get("/me/achievements", authenticateJWT, getMyAchievements);

// U9 — Push subscriptions
router.post("/me/push-subscription",    authenticateJWT, subscribePush);
router.delete("/me/push-subscription",  authenticateJWT, unsubscribePush);

// U4 — User directory & public profile
router.get("/",          authenticateJWT, listUsers);
router.get("/:userId",   authenticateJWT, getUserProfile);

export default router;
