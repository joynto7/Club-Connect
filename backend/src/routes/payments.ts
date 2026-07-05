import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { stripeWebhook, getMyPayments } from "../controllers/paymentController.ts";

const router = express.Router();

// Stripe webhook — raw body required, no auth
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// My payment history
router.get("/my", authenticateJWT, getMyPayments);

export default router;
