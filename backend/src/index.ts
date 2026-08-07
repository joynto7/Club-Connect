import "dotenv/config";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import authRoutes from "./routes/auth.ts";
import eventRoutes from "./routes/events.ts";
import userRoutes from "./routes/users.ts";
import clubRoutes from "./routes/clubs.ts";
import adminRoutes from "./routes/admin.ts";
import venueRoutes from "./routes/venues.ts";
import resourceRoutes from "./routes/resources.ts";
import notificationRoutes from "./routes/notifications.ts";
import announcementRoutes from "./routes/announcements.ts";
import contentRoutes from "./routes/content.ts";
import searchRoutes from "./routes/search.ts";
import reportRoutes from "./routes/reports.ts";
import uploadRoutes from "./routes/uploads.ts";
import feedRoutes from "./routes/feed.ts";
import leaderboardRoutes from "./routes/leaderboard.ts";
import aiRoutes from "./routes/ai.ts";
import paymentRoutes from "./routes/payments.ts";
import integrationRoutes from "./routes/integrations.ts";
import swaggerSpec from "./lib/swagger.ts";
import { logger } from "./lib/logger.ts";
import { accessTokenSecret } from "./lib/jwtSecrets.ts";
import { seedAchievements } from "./services/achievementService.ts";
import { startReminderJob } from "./jobs/reminderJob.ts";
import prisma from "./prisma.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT ?? 5001);
const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";

const allowedOrigins = [
  frontendUrl,
  frontendUrl.replace("127.0.0.1", "localhost"),
  frontendUrl.replace("localhost", "127.0.0.1"),
];

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip, ua: req.headers["user-agent"] });
  next();
});

app.use("/payments", paymentRoutes);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../../public/uploads")));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/users", userRoutes);
app.use("/clubs", clubRoutes);
app.use("/admin", adminRoutes);
app.use("/venues", venueRoutes);
app.use("/resources", resourceRoutes);
app.use("/notifications", notificationRoutes);
app.use("/announcements", announcementRoutes);
app.use("/content", contentRoutes);
app.use("/search", searchRoutes);
app.use("/reports", reportRoutes);
app.use("/uploads", uploadRoutes);
app.use("/feed", feedRoutes);
app.use("/leaderboard", leaderboardRoutes);
app.use("/ai", aiRoutes);
app.use("/clubs/:id/integrations", integrationRoutes);
// Swagger docs expose the full API surface — dev only, never public in production.
if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "Club Connect API" }));
  app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));
}

// ── Health checks ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.send("OK"));

app.get("/health/json", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "OK", db: "connected", uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: "ERROR", db: "disconnected" });
  }
});

app.get("/", (_req, res) => res.send("Club Connect backend is running."));

// ── Global error handler ──────────────────────────────────────────────────────
// Must be last — four-argument signature tells Express this is an error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal server error",
    ...(isProd ? {} : { detail: err.message }),
  });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

export const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

// Wire up Redis adapter when REDIS_URL is set (required for multi-instance deploys)
if (process.env.REDIS_URL) {
  const pubClient = new Redis(process.env.REDIS_URL);
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.io Redis adapter connected");
}

io.use((socket, next) => {
  const token = socket.handshake.auth["token"] as string | undefined;
  if (!token) return next(new Error("Unauthorized"));
  try {
    const payload = jwt.verify(token, accessTokenSecret) as {
      userId: string;
      role: string;
    };
    socket.data["userId"] = payload.userId;
    socket.data["role"] = payload.role;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data["userId"] as string;
  const role = socket.data["role"] as string;

  void socket.join(`user:${userId}`);

  if (role === "UNIVERSITY_ADMIN" || role === "SYSTEM_ADMIN") {
    void socket.join("admin");
  }

  socket.on("join:event", (eventId: string) => void socket.join(`event:${eventId}`));
  socket.on("leave:event", (eventId: string) => void socket.leave(`event:${eventId}`));
});

// ── Start server ──────────────────────────────────────────────────────────────
const server = httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  seedAchievements().catch((err) => logger.error("seedAchievements failed", { err }));
  startReminderJob();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// On SIGTERM (sent by Docker/Kubernetes/Railway when stopping the container),
// stop accepting new connections, let in-flight requests finish, then exit.
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Database disconnected. Process exiting.");
    process.exit(0);
  });

  // Force exit if shutdown takes longer than 15 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 15_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
  process.exit(1);
});
