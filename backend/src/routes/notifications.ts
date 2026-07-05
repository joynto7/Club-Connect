import { Router } from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from "../controllers/notificationController.ts";

const router = Router();

router.get("/",           authenticateJWT, listNotifications);
router.put("/read-all",   authenticateJWT, markAllRead);
router.put("/:id/read",   authenticateJWT, markRead);
router.delete("/:id",     authenticateJWT, deleteNotification);

export default router;
