import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import nodemailer from "nodemailer";
import { z } from "zod";
import { generateSecret, generateURI, verify as verifyOTP, verifySync as verifyOTPSync } from "otplib";
import qrcode from "qrcode";
import prisma from "../prisma.ts";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const emailVerificationSchema = z.object({
  token: z.string().min(10),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  department: z.string().optional(),
  year: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const accessTokenSecret: Secret = process.env.JWT_ACCESS_TOKEN_SECRET ?? "replace-with-secret";
const refreshTokenSecret: Secret = process.env.JWT_REFRESH_TOKEN_SECRET ?? "replace-with-secret";
const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m";
const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d";
const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5001";
const skipEmailVerification = process.env.SKIP_EMAIL_VERIFICATION === "true";

const createAccessToken = (user: { id: string; email: string; role: string }) =>
  jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    accessTokenSecret,
    { expiresIn: accessTokenExpiresIn } as SignOptions
  );

const createRefreshToken = (user: { id: string; email: string; role: string }) =>
  jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    refreshTokenSecret,
    { expiresIn: refreshTokenExpiresIn } as SignOptions
  );

const sendEmail = async (to: string, subject: string, html: string) => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? "Club Connect <no-reply@clubconnect.local>",
      to,
      subject,
      html,
    });
    return;
  }

  console.log("=== EMAIL DUMP ===");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(html);
};

const createRandomToken = () => crypto.randomBytes(24).toString("hex");

const refreshTokenTtlMs = () => {
  // Parse the refreshTokenExpiresIn string (e.g. "7d") to milliseconds
  const match = refreshTokenExpiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, num, unit] = match;
  const n = parseInt(num!, 10);
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * (multipliers[unit!] ?? 86400000);
};

export const register: RequestHandler = async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const { email, name, password, department, year } = parseResult.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email is already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const emailVerificationToken = createRandomToken();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: passwordHash,
      department:  department  ?? null,
      year:        year        ?? null,
      emailVerificationToken,
      emailVerificationTokenExpires,
      emailVerified: skipEmailVerification,
    },
  });

  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  await sendEmail(
    email,
    "Verify your Club Connect email",
    `<p>Hi ${name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.status(201).json({
    message: skipEmailVerification
      ? "Registration complete. Email verification skipped for dev mode."
      : "Registration successful. Please check your email to verify your account.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
};

export const verifyEmail: RequestHandler = async (req, res) => {
  const parseResult = emailVerificationSchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid verification token" });
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: parseResult.data.token,
      emailVerificationTokenExpires: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(400).json({ error: "Verification token is invalid or expired" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    },
  });

  return res.json({ message: "Email verified successfully. You can now log in." });
};

// UC-11.1 — Resend verification email
export const resendVerification: RequestHandler = async (req, res) => {
  const parseResult = resendVerificationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  // Always return 200 to avoid leaking which emails are registered
  const user = await prisma.user.findUnique({ where: { email: parseResult.data.email } });
  if (!user || user.emailVerified) {
    return res.json({ message: "If the email is registered and unverified, a new verification link has been sent." });
  }

  const emailVerificationToken = createRandomToken();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken, emailVerificationTokenExpires },
  });

  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  await sendEmail(
    user.email,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.json({ message: "If the email is registered and unverified, a new verification link has been sent." });
};

export const login: RequestHandler = async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const { email, password } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Account lockout check
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({
      error: `Account temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute(s).`,
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    const newAttempts = user.loginAttempts + 1;
    const locked = newAttempts >= MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });
    if (locked) {
      return res.status(423).json({
        error: `Too many failed login attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
      });
    }
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (!user.emailVerified && !skipEmailVerification) {
    return res.status(403).json({ error: "Please verify your email before logging in." });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: `Your account has been suspended. Reason: ${user.suspendedReason ?? "Contact an administrator for details."}` });
  }

  // Reset login attempts on success
  await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });

  // If 2FA is enabled, issue a short-lived temp token instead of full tokens
  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      { userId: user.id, purpose: "2fa" },
      accessTokenSecret,
      { expiresIn: "5m" } as SignOptions
    );
    return res.status(200).json({ requires2FA: true, tempToken });
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const refreshTokenExpires = new Date(Date.now() + refreshTokenTtlMs());

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshToken: refreshTokenHash,
      refreshTokenExpires,
    },
  });

  // Create session record
  const userAgent = req.headers["user-agent"] ?? null;
  const ipAddress = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? null;

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: refreshTokenExpires,
    },
  });

  return res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
};

export const refreshToken: RequestHandler = async (req, res) => {
  const parseResult = refreshTokenSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  try {
    const payload = jwt.verify(parseResult.data.refreshToken, refreshTokenSecret) as {
      userId: string;
    };

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.refreshToken || !user.refreshTokenExpires) {
      return res.status(401).json({ error: "Refresh token invalid" });
    }

    if (user.refreshTokenExpires < new Date()) {
      return res.status(401).json({ error: "Refresh token expired" });
    }

    const valid = await bcrypt.compare(parseResult.data.refreshToken, user.refreshToken);
    if (!valid) {
      return res.status(401).json({ error: "Refresh token invalid" });
    }

    const accessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);
    const refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const refreshTokenExpires = new Date(Date.now() + refreshTokenTtlMs());

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshTokenExpires,
      },
    });

    // Rotate session token
    const oldHash = user.refreshToken;
    const session = await prisma.session.findFirst({ where: { userId: user.id, tokenHash: oldHash } });
    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { tokenHash: refreshTokenHash, expiresAt: refreshTokenExpires },
      });
    }

    return res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
};

export const logout: RequestHandler = async (req, res) => {
  const parseResult = refreshTokenSchema.safeParse(req.body);
  if (!parseResult.success) {
    // Still succeed even if no token provided
    return res.json({ message: "Logged out" });
  }

  try {
    const payload = jwt.verify(parseResult.data.refreshToken, refreshTokenSecret) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (user?.refreshToken) {
      const valid = await bcrypt.compare(parseResult.data.refreshToken, user.refreshToken);
      if (valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null, refreshTokenExpires: null },
        });
        // Delete the matching session
        await prisma.session.deleteMany({ where: { userId: user.id, tokenHash: user.refreshToken } });
      }
    }
  } catch {
    // Ignore — still log out
  }

  return res.json({ message: "Logged out" });
};

export const requestPasswordReset: RequestHandler = async (req, res) => {
  const parseResult = passwordResetRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const user = await prisma.user.findUnique({ where: { email: parseResult.data.email } });
  if (!user) {
    return res.status(200).json({ message: "If the email is registered, a reset link will be sent." });
  }

  const passwordResetToken = createRandomToken();
  const passwordResetTokenExpires = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken,
      passwordResetTokenExpires,
    },
  });

  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(passwordResetToken)}`;
  await sendEmail(
    user.email,
    "Club Connect password reset",
    `<p>Hi ${user.name},</p><p>Reset your password by clicking the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>The link is valid for one hour.</p>`
  );

  return res.json({ message: "If the email is registered, a reset link will be sent." });
};

export const resetPassword: RequestHandler = async (req, res) => {
  const parseResult = passwordResetSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: parseResult.data.token,
      passwordResetTokenExpires: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(400).json({ error: "Reset token is invalid or expired" });
  }

  const passwordHash = await bcrypt.hash(parseResult.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
    },
  });

  return res.json({ message: "Password has been reset. You can now log in with the new password." });
};

export const whoAmI: RequestHandler = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      year: true,
      interests: true,
      avatarUrl: true,
      emailVerified: true,
      isSuspended: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({ user });
};

// UC-8.3 — Session management
export const getSessions: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const sessions = await prisma.session.findMany({
    where: { userId: req.user.id, expiresAt: { gte: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ sessions });
};

export const revokeSession: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const sessionId = req.params["id"] as string;
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: req.user.id },
  });

  if (!session) return res.status(404).json({ error: "Session not found" });

  await prisma.session.delete({ where: { id: sessionId } });
  return res.json({ message: "Session revoked" });
};

export const revokeAllSessions: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  await prisma.session.deleteMany({ where: { userId: req.user.id } });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { refreshToken: null, refreshTokenExpires: null },
  });

  return res.json({ message: "All sessions revoked. You have been logged out of all devices." });
};

// ── U10.5 — Two-Factor Authentication ────────────────────────────────────────

const twoFaTokenSchema = z.object({ token: z.string().length(6) });
const twoFaLoginSchema = z.object({ tempToken: z.string().min(10), token: z.string().length(6) });

export const setup2FA: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const secret = generateSecret();
  const otpAuthUrl = generateURI({ issuer: "Club Connect", label: req.user.email, secret });
  const qrDataUrl = await qrcode.toDataURL(otpAuthUrl);

  await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorSecret: secret } });

  return res.json({ secret, qrDataUrl });
};

export const verify2FA: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = twoFaTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { twoFactorSecret: true },
  });
  if (!user?.twoFactorSecret) return res.status(400).json({ error: "2FA setup not started. Call /auth/2fa/setup first." });

  const result = verifyOTPSync({ token: parsed.data.token, secret: user.twoFactorSecret });
  if (!result.valid) return res.status(400).json({ error: "Invalid verification code" });

  await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorEnabled: true } });

  return res.json({ message: "Two-factor authentication enabled" });
};

export const disable2FA: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = twoFaTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(400).json({ error: "2FA is not enabled on this account" });
  }

  const isValid = verifyOTPSync({ token: parsed.data.token, secret: user.twoFactorSecret });
  if (!isValid) return res.status(400).json({ error: "Invalid verification code" });

  await prisma.user.update({
    where: { id: req.user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  return res.json({ message: "Two-factor authentication disabled" });
};

// ── U12.2 — Google OAuth ───────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = `${process.env.APP_URL ?? "http://127.0.0.1:5001"}/auth/google/callback`;

export const googleOAuthRedirect: RequestHandler = (_req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth not configured" });
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

export const googleOAuthCallback: RequestHandler = async (req, res) => {
  const code = req.query["code"] as string | undefined;
  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=google_cancelled`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return res.redirect(`${frontendUrl}/login?error=google_token_exchange_failed`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Get user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      return res.redirect(`${frontendUrl}/login?error=google_userinfo_failed`);
    }

    const googleUser = (await userInfoRes.json()) as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    // Find-or-create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.sub }, { email: googleUser.email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          password: "", // No password for OAuth users
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture ?? null,
          emailVerified: true,
        },
      });
    } else if (!user.googleId) {
      // Existing email account — link Google ID
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.sub, emailVerified: true },
      });
    }

    if (user.isSuspended) {
      return res.redirect(`${frontendUrl}/login?error=account_suspended`);
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenExpires = new Date(Date.now() + refreshTokenTtlMs());

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash, refreshTokenExpires, loginAttempts: 0, lockedUntil: null },
    });

    const userAgent = req.headers["user-agent"] ?? null;
    const ipAddress =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      null;

    await prisma.session.create({
      data: { userId: user.id, tokenHash: refreshTokenHash, userAgent, ipAddress, expiresAt: refreshTokenExpires },
    });

    // Redirect to frontend with tokens in query params (frontend will save them)
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.redirect(`${frontendUrl}/auth/google/callback?${params.toString()}`);
  } catch {
    res.redirect(`${frontendUrl}/login?error=google_oauth_failed`);
  }
};

export const login2FA: RequestHandler = async (req, res) => {
  const parsed = twoFaLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { tempToken, token } = parsed.data;

  let payload: { userId: string; purpose: string };
  try {
    payload = jwt.verify(tempToken, accessTokenSecret) as { userId: string; purpose: string };
  } catch {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
  if (payload.purpose !== "2fa") return res.status(401).json({ error: "Invalid token purpose" });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(400).json({ error: "2FA is not configured for this account" });
  }

  const loginResult = verifyOTPSync({ token, secret: user.twoFactorSecret });
  if (!loginResult.valid) return res.status(400).json({ error: "Invalid verification code" });

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const refreshTokenExpires = new Date(Date.now() + refreshTokenTtlMs());

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: refreshTokenHash, refreshTokenExpires },
  });

  const userAgent = req.headers["user-agent"] ?? null;
  const ipAddress = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? null;

  await prisma.session.create({
    data: { userId: user.id, tokenHash: refreshTokenHash, userAgent, ipAddress, expiresAt: refreshTokenExpires },
  });

  return res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
};
