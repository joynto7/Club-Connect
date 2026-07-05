import { Router } from "express";
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
import {
  listResources,
  createResourceBooking,
  getMyResourceBookings,
  getAllResourceBookings,
  approveResourceBooking,
  rejectResourceBooking,
  cancelResourceBooking,
  createResource,
  updateResource,
} from "../controllers/resourceController.ts";

const router = Router();

// Specific booking sub-routes before /:id
router.get("/bookings/mine", authenticateJWT, getMyResourceBookings);
router.get(
  "/bookings",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  getAllResourceBookings,
);
router.post(
  "/bookings/:bookingId/approve",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  approveResourceBooking,
);
router.post(
  "/bookings/:bookingId/reject",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  rejectResourceBooking,
);
router.delete("/bookings/:bookingId", authenticateJWT, cancelResourceBooking);

// Admin — resource CRUD
router.post(
  "/",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  createResource,
);

// Public — list resources
router.get("/", optionalAuth, listResources);

// Authenticated — book a resource
router.post("/:id/book", authenticateJWT, createResourceBooking);

// Admin — update resource
router.put(
  "/:id",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  updateResource,
);

export default router;
