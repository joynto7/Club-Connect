import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import {
  listIntegrations,
  upsertIntegration,
  deleteIntegration,
} from "../controllers/integrationController.ts";

const router = express.Router({ mergeParams: true });

router.get("/", authenticateJWT, listIntegrations);
router.post("/", authenticateJWT, upsertIntegration);
router.delete("/:integrationId", authenticateJWT, deleteIntegration);

export default router;
