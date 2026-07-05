import { Router } from "express";
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcementController.ts";

const router = Router();

router.get("/",     optionalAuth,    listAnnouncements);
router.post("/",    authenticateJWT, createAnnouncement);
router.put("/:id",  authenticateJWT, updateAnnouncement);
router.delete("/:id", authenticateJWT, deleteAnnouncement);

export default router;
