import express from "express";
import { Role } from "@prisma/client";
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  cancelEvent,
  approveEvent,
  rejectEvent,
  registerForEvent,
  cancelRegistration,
  getAttendees,
  checkInUser,
  getMyRegistrations,
  getEventIcs,
} from "../controllers/eventController.ts";
import { getTicket, scanTicket, setReminder } from "../controllers/ticketController.ts";
import { createCheckoutSession } from "../controllers/paymentController.ts";
import {
  submitFeedback,
  getMyFeedback,
  getEventFeedback,
} from "../controllers/feedbackController.ts";
import {
  listQuestions,
  submitQuestion,
  upvoteQuestion,
  answerQuestion,
} from "../controllers/eventQAController.ts";

const router = express.Router();

// Public / optional-auth
router.get("/",                   optionalAuth, listEvents);
router.get("/me/registrations",   authenticateJWT, getMyRegistrations);
router.get("/:id",                optionalAuth, getEvent);

// Officer: create / edit / cancel
router.post("/",    authenticateJWT, createEvent);
router.put("/:id",  authenticateJWT, updateEvent);
router.delete("/:id", authenticateJWT, cancelEvent);

// Admin: approve / reject
router.post(
  "/:id/approve",
  authenticateJWT,
  requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]),
  approveEvent
);
router.post(
  "/:id/reject",
  authenticateJWT,
  requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]),
  rejectEvent
);

// Student: register / cancel
router.post("/:id/register",   authenticateJWT, registerForEvent);
router.delete("/:id/register", authenticateJWT, cancelRegistration);

// Officer: attendees + check-in
router.get("/:id/attendees",             authenticateJWT, getAttendees);
router.post("/:id/checkin/:userId",      authenticateJWT, checkInUser);

// Feedback (UC-6.1, UC-6.2)
router.get("/:id/feedback/mine",  authenticateJWT, getMyFeedback);
router.get("/:id/feedback",       authenticateJWT, getEventFeedback);
router.post("/:id/feedback",      authenticateJWT, submitFeedback);

// Q&A (U4)
router.get("/:id/questions",                    optionalAuth, listQuestions);
router.post("/:id/questions",                   authenticateJWT, submitQuestion);
router.post("/:id/questions/:qId/upvote",       authenticateJWT, upvoteQuestion);
router.put("/:id/questions/:qId/answer",        authenticateJWT, answerQuestion);

// QR Tickets (U6)
router.get("/:id/ticket",   authenticateJWT, getTicket);
router.post("/:id/scan",    authenticateJWT, scanTicket);
router.post("/:id/reminders", authenticateJWT, setReminder);

// iCal Export (U8)
router.get("/:id/ics", optionalAuth, getEventIcs);

// Paid tickets checkout (U11)
router.post("/:id/checkout", authenticateJWT, createCheckoutSession);

export default router;
