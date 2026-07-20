import express from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  logout,
  register,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
  changeUnverifiedEmail,
  whoAmI,
  getSessions,
  revokeSession,
  revokeAllSessions,
  setup2FA,
  verify2FA,
  disable2FA,
  login2FA,
  googleOAuthRedirect,
  googleOAuthCallback,
} from "../controllers/authController.ts";
import { authenticateJWT } from "../middleware/authMiddleware.ts";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again in 15 minutes." },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again in 15 minutes." },
});

router.post("/register", authLimiter, register);
router.post("/login", strictLimiter, login);
router.post("/logout", logout);
router.post("/refresh-token", authLimiter, refreshToken);
router.post("/verify-email", strictLimiter, verifyEmail);
router.post("/resend-verification", authLimiter, resendVerification);
router.post("/change-unverified-email", strictLimiter, changeUnverifiedEmail);
router.post("/request-password-reset", authLimiter, requestPasswordReset);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", authenticateJWT, whoAmI);

// Session management (UC-8.3)
router.get("/sessions", authenticateJWT, getSessions);
router.delete("/sessions/all", authenticateJWT, revokeAllSessions);
router.delete("/sessions/:id", authenticateJWT, revokeSession);

// U10.5 — Two-Factor Authentication
router.post("/2fa/setup",   authenticateJWT, setup2FA);
router.post("/2fa/verify",  authenticateJWT, verify2FA);
router.post("/2fa/disable", authenticateJWT, disable2FA);
router.post("/2fa/login",   strictLimiter, login2FA);

// U12.2 — Google OAuth
router.get("/google", googleOAuthRedirect);
router.get("/google/callback", googleOAuthCallback);

export default router;
