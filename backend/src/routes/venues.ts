import { Router } from "express";
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
import {
  listVenues,
  getVenue,
  getVenueAvailability,
  createVenueBooking,
  getMyVenueBookings,
  getAllVenueBookings,
  approveVenueBooking,
  rejectVenueBooking,
  cancelVenueBooking,
  createVenue,
  updateVenue,
} from "../controllers/venueController.ts";

const router = Router();

// Specific booking sub-routes must come before /:id to avoid param collision
router.get("/bookings/mine", authenticateJWT, getMyVenueBookings);
router.get(
  "/bookings",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  getAllVenueBookings,
);
router.post(
  "/bookings/:bookingId/approve",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  approveVenueBooking,
);
router.post(
  "/bookings/:bookingId/reject",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  rejectVenueBooking,
);
router.delete("/bookings/:bookingId", authenticateJWT, cancelVenueBooking);

// Admin — venue CRUD
router.post(
  "/",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  createVenue,
);

// Public — venue listing + detail
router.get("/", optionalAuth, listVenues);
router.get("/:id", optionalAuth, getVenue);
router.get("/:id/availability", optionalAuth, getVenueAvailability);

// Authenticated — book a venue
router.post("/:id/book", authenticateJWT, createVenueBooking);

// Admin — update venue
router.put(
  "/:id",
  authenticateJWT,
  requireRole(["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"]),
  updateVenue,
);

export default router;
