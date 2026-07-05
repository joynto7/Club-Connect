import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, ClubRole, MembershipStatus } from "@prisma/client";
import prisma from "../prisma.ts";

async function isOfficer(userId: string, userRole: string, clubId: string): Promise<boolean> {
  if (userRole === Role.UNIVERSITY_ADMIN || userRole === Role.SYSTEM_ADMIN) return true;
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  return (
    m?.status === MembershipStatus.APPROVED &&
    (m.role === ClubRole.PRESIDENT || m.role === ClubRole.COORDINATOR)
  );
}

async function isMember(userId: string, clubId: string): Promise<boolean> {
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  return m?.status === MembershipStatus.APPROVED;
}

const POST_SELECT = {
  id: true,
  title: true,
  content: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { comments: true, reactions: true } },
} as const;

// GET /clubs/:id/posts
export const listPosts: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const userId = req.user?.id;

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) { res.status(404).json({ error: "Club not found" }); return; }

  const posts = await prisma.clubPost.findMany({
    where: { clubId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    select: POST_SELECT,
  });

  // Attach user's reaction for each post
  let userReactions: Record<string, string> = {};
  if (userId) {
    const reactions = await prisma.clubPostReaction.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true, emoji: true },
    });
    userReactions = Object.fromEntries(reactions.map((r) => [r.postId, r.emoji]));
  }

  res.json(posts.map((p) => ({ ...p, myReaction: userReactions[p.id] ?? null })));
};

// GET /clubs/:id/posts/:postId/comments
export const listComments: RequestHandler = async (req, res) => {
  const { id: clubId, postId } = req.params as { id: string; postId: string };
  const post = await prisma.clubPost.findFirst({ where: { id: postId, clubId } });
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const comments = await prisma.clubPostComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  res.json(comments);
};

// POST /clubs/:id/posts — officer only
export const createPost: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  if (!(await isOfficer(userId, userRole, clubId))) {
    res.status(403).json({ error: "Only club officers can create posts" });
    return;
  }

  const schema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const post = await prisma.clubPost.create({
    data: { clubId, authorId: userId, ...parsed.data },
    select: POST_SELECT,
  });
  res.status(201).json({ ...post, myReaction: null });
};

// PUT /clubs/:id/posts/:postId
export const updatePost: RequestHandler = async (req, res) => {
  const { id: clubId, postId } = req.params as { id: string; postId: string };
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const post = await prisma.clubPost.findFirst({ where: { id: postId, clubId } });
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const canEdit = post.authorId === userId || (await isOfficer(userId, userRole, clubId));
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const updateData: { title?: string; content?: string } = {};
  if (parsed.data.title   !== undefined) updateData.title   = parsed.data.title;
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;

  const updated = await prisma.clubPost.update({
    where: { id: postId },
    data: updateData,
    select: POST_SELECT,
  });
  res.json(updated);
};

// DELETE /clubs/:id/posts/:postId
export const deletePost: RequestHandler = async (req, res) => {
  const { id: clubId, postId } = req.params as { id: string; postId: string };
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const post = await prisma.clubPost.findFirst({ where: { id: postId, clubId } });
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const canDelete = post.authorId === userId || (await isOfficer(userId, userRole, clubId));
  if (!canDelete) { res.status(403).json({ error: "Forbidden" }); return; }

  await prisma.clubPost.delete({ where: { id: postId } });
  res.status(204).send();
};

// POST /clubs/:id/posts/:postId/pin — officer only
export const pinPost: RequestHandler = async (req, res) => {
  const { id: clubId, postId } = req.params as { id: string; postId: string };
  const userId = req.user!.id;
  const userRole = req.user!.role;

  if (!(await isOfficer(userId, userRole, clubId))) {
    res.status(403).json({ error: "Only club officers can pin posts" });
    return;
  }

  const post = await prisma.clubPost.findFirst({ where: { id: postId, clubId } });
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const updated = await prisma.clubPost.update({
    where: { id: postId },
    data: { isPinned: !post.isPinned },
    select: POST_SELECT,
  });
  res.json(updated);
};

// POST /clubs/:id/posts/:postId/comments — member
export const addComment: RequestHandler = async (req, res) => {
  const { id: clubId, postId } = req.params as { id: string; postId: string };
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const post = await prisma.clubPost.findFirst({ where: { id: postId, clubId } });
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  // Officers can always comment; others must be members
  const allowed = (await isOfficer(userId, userRole, clubId)) || (await isMember(userId, clubId));
  if (!allowed) { res.status(403).json({ error: "Must be a club member to comment" }); return; }

  const schema = z.object({ content: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const comment = await prisma.clubPostComment.create({
    data: { postId, authorId: userId, content: parsed.data.content },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  res.status(201).json(comment);
};

// DELETE /clubs/:id/posts/:postId/comments/:commentId
export const deleteComment: RequestHandler = async (req, res) => {
  const { id: clubId, postId, commentId } = req.params as {
    id: string; postId: string; commentId: string;
  };
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const comment = await prisma.clubPostComment.findFirst({
    where: { id: commentId, postId, post: { clubId } },
  });
  if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

  const canDelete = comment.authorId === userId || (await isOfficer(userId, userRole, clubId));
  if (!canDelete) { res.status(403).json({ error: "Forbidden" }); return; }

  await prisma.clubPostComment.delete({ where: { id: commentId } });
  res.status(204).send();
};

// POST /clubs/:id/posts/:postId/react — toggle reaction
export const reactToPost: RequestHandler = async (req, res) => {
  const { id: clubId, postId } = req.params as { id: string; postId: string };
  const userId = req.user!.id;

  const post = await prisma.clubPost.findFirst({ where: { id: postId, clubId } });
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const schema = z.object({ emoji: z.string().min(1).max(10).default("👍") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await prisma.clubPostReaction.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    if (existing.emoji === parsed.data.emoji) {
      // Same emoji — remove reaction (toggle off)
      await prisma.clubPostReaction.delete({ where: { postId_userId: { postId, userId } } });
      res.json({ action: "removed", emoji: null });
    } else {
      // Different emoji — update
      await prisma.clubPostReaction.update({
        where: { postId_userId: { postId, userId } },
        data: { emoji: parsed.data.emoji },
      });
      res.json({ action: "updated", emoji: parsed.data.emoji });
    }
  } else {
    await prisma.clubPostReaction.create({
      data: { postId, userId, emoji: parsed.data.emoji },
    });
    res.json({ action: "added", emoji: parsed.data.emoji });
  }
};
