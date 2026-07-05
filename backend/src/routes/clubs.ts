import express from "express";
import { Role } from "@prisma/client";
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
import {
  listClubs,
  getClub,
  createClub,
  approveClub,
  rejectClub,
  deactivateClub,
  updateClub,
  listMembers,
  requestMembership,
  approveMembership,
  rejectMembership,
  updateMemberRole,
  removeMember,
  followClub,
  unfollowClub,
} from "../controllers/clubController.ts";
import { getClubAnalytics } from "../controllers/analyticsController.ts";
import {
  getClubBudget,
  addBudgetTransaction,
  deleteBudgetTransaction,
  allocateBudget,
} from "../controllers/paymentController.ts";
import {
  listPosts,
  listComments,
  createPost,
  updatePost,
  deletePost,
  pinPost,
  addComment,
  deleteComment,
  reactToPost,
} from "../controllers/clubPostController.ts";

const router = express.Router();

// Public-ish routes (auth optional — membership status shown when logged in)
router.get("/",          optionalAuth, listClubs);
router.get("/:slugOrId", optionalAuth, getClub);

// Authenticated routes
router.post("/",                                    authenticateJWT, createClub);
router.put("/:id",                                  authenticateJWT, updateClub);

// Admin-only
router.post("/:id/approve",  authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), approveClub);
router.post("/:id/reject",   authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), rejectClub);
router.delete("/:id",        authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), deactivateClub);

// Membership management
router.get("/:id/members",                    authenticateJWT, listMembers);
router.post("/:id/members/request",           authenticateJWT, requestMembership);
router.post("/:id/members/:userId/approve",   authenticateJWT, approveMembership);
router.post("/:id/members/:userId/reject",    authenticateJWT, rejectMembership);
router.put("/:id/members/:userId/role",       authenticateJWT, updateMemberRole);
router.delete("/:id/members/:userId",         authenticateJWT, removeMember);

// Follow system (U4)
router.post("/:id/follow",   authenticateJWT, followClub);
router.delete("/:id/follow", authenticateJWT, unfollowClub);

// Analytics (UC-6.3)
router.get("/:id/analytics", authenticateJWT, getClubAnalytics);

// Budget (U11)
router.get("/:id/budget",                          authenticateJWT, getClubBudget);
router.post("/:id/budget/transactions",            authenticateJWT, addBudgetTransaction);
router.delete("/:id/budget/transactions/:txId",    authenticateJWT, deleteBudgetTransaction);
router.put("/:id/budget/allocate",                 authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), allocateBudget);

// Club posts (U4)
router.get("/:id/posts",                                           authenticateJWT, listPosts);
router.post("/:id/posts",                                          authenticateJWT, createPost);
router.put("/:id/posts/:postId",                                   authenticateJWT, updatePost);
router.delete("/:id/posts/:postId",                                authenticateJWT, deletePost);
router.post("/:id/posts/:postId/pin",                              authenticateJWT, pinPost);
router.get("/:id/posts/:postId/comments",                          authenticateJWT, listComments);
router.post("/:id/posts/:postId/comments",                         authenticateJWT, addComment);
router.delete("/:id/posts/:postId/comments/:commentId",            authenticateJWT, deleteComment);
router.post("/:id/posts/:postId/react",                            authenticateJWT, reactToPost);

export default router;
