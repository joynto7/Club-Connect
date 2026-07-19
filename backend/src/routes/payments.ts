import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import {
  sslcommerzSuccess,
  sslcommerzFail,
  sslcommerzCancel,
  sslcommerzIPN,
  getMyPayments,
} from "../controllers/paymentController.ts";

const router = express.Router();

// SSLCommerz posts form-encoded data to these — no auth, the gateway calls them directly
const formParser = express.urlencoded({ extended: true });
router.post("/sslcommerz/success", formParser, sslcommerzSuccess);
router.post("/sslcommerz/fail", formParser, sslcommerzFail);
router.post("/sslcommerz/cancel", formParser, sslcommerzCancel);
router.post("/sslcommerz/ipn", formParser, sslcommerzIPN);

// My payment history
router.get("/my", authenticateJWT, getMyPayments);

export default router;
