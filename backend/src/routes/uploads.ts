import { Router } from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { uploadImage } from "../middleware/upload.ts";
import { uploadFile } from "../controllers/uploadController.ts";

const router = Router();

router.post("/", authenticateJWT, uploadImage, uploadFile);

export default router;
