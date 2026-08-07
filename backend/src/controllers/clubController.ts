import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, ClubStatus, ClubRole, MembershipStatus } from "@prisma/client";
import prisma from "../prisma.ts";
import { createNotification } from "../services/notificationService.ts";
import { log as auditLog } from "../lib/auditLog.ts";
import { emitToAdmin } from "../lib/socket.ts";
import { awardPoints } from "../services/pointsService.ts";
import { fireWebhooks } from "../services/webhookService.ts";
import { generateSlug } from "../lib/textHelpers.ts";
import { isClubOfficer } from "../lib/clubAuth.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = generateSlug(name);
  let slug = base;
  let n = 1;
  while (true) {
    const existing = await prisma.club.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    slug = `${base}-${n++}`;
  }
  return slug;
}


const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  message: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true, department: true, year: true } },
} as const;

// ── Schemas ──────────────────────────────────────────────────────────────────

const createClubSchema = z.object({
  name:         z.string().min(2, "Club name must be at least 2 characters"),
  description:  z.string().min(10, "Description must be at least 10 characters").optional(),
  category:     z.string().default("General"),
  contactEmail: z.string().email("Invalid contact email").optional().or(z.literal("")),
  phone:        z.string().optional(),
  socialLinks:  z.record(z.string()).optional(),
  tags:         z.array(z.string()).optional(),
  logoUrl:      z.string().url().optional().or(z.literal("")),
});

const updateClubSchema = z.object({
  name:         z.string().min(2).optional(),
  description:  z.string().min(10).optional(),
  category:     z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  phone:        z.string().optional().or(z.literal("")),
  socialLinks:  z.record(z.string()).optional(),
  tags:         z.array(z.string()).optional(),
  logoUrl:      z.string().url().optional().or(z.literal("")),
  bannerUrl:    z.string().url().optional().or(z.literal("")),
});

const rejectSchema        = z.object({ note: z.string().optional() });
const membershipReqSchema = z.object({ message: z.string().optional() });
const roleUpdateSchema    = z.object({ role: z.nativeEnum(ClubRole) });

// ── UC-2.3 / UC-2.4 / UC-2.5 — Browse + Search + Filter ─────────────────────

export const listClubs: RequestHandler = async (req, res) => {
  const search   = req.query["search"]   as string | undefined;
  const category = req.query["category"] as string | undefined;
  const status   = req.query["status"]   as ClubStatus | undefined;

  const clubs = await prisma.club.findMany({
    where: {
      status: status ?? ClubStatus.ACTIVE,
      ...(category && category !== "All" ? { category } : {}),
      ...(search ? {
        OR: [
          { name:        { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    select: {
      id: true, name: true, slug: true, description: true, category: true,
      logoUrl: true, tags: true, status: true, createdAt: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { memberships: { where: { status: MembershipStatus.APPROVED } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ clubs });
};

// ── UC-2.6 — View Club Profile ────────────────────────────────────────────────

export const getClub: RequestHandler = async (req, res) => {
  const slugOrId = req.params["slugOrId"] as string;
  if (!slugOrId) return res.status(400).json({ error: "Club identifier required" });

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  const club = await prisma.club.findFirst({
    where: isUuid ? { id: slugOrId } : { slug: slugOrId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      memberships: {
        where: { status: MembershipStatus.APPROVED },
        include: { user: { select: { id: true, name: true, avatarUrl: true, department: true } } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: {
          memberships: { where: { status: MembershipStatus.APPROVED } },
          followers: true,
        },
      },
    },
  });

  if (!club) return res.status(404).json({ error: "Club not found" });

  let myMembership = null;
  let isFollowing = false;
  if (req.user) {
    [myMembership] = await Promise.all([
      prisma.clubMembership.findUnique({
        where: { clubId_userId: { clubId: club.id, userId: req.user.id } },
        select: { id: true, role: true, status: true },
      }),
    ]);
    const follow = await prisma.clubFollow.findUnique({
      where: { userId_clubId: { userId: req.user.id, clubId: club.id } },
    });
    isFollowing = follow !== null;
  }

  return res.json({ club, myMembership, isFollowing });
};

// ── UC-2.1 — Request Club Creation ───────────────────────────────────────────

export const createClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { name, description, category, contactEmail, phone, socialLinks, tags, logoUrl } = parsed.data;

  const exists = await prisma.club.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (exists) return res.status(409).json({ error: "A club with this name already exists" });

  const slug = await uniqueSlug(name);

  const club = await prisma.club.create({
    data: {
      name,
      slug,
      description:  description  ?? null,
      category:     category     ?? "General",
      contactEmail: contactEmail ? contactEmail : null,
      phone:        phone        ? phone        : null,
      socialLinks:  socialLinks  ?? {},
      tags:         tags         ?? [],
      logoUrl:      logoUrl      ? logoUrl      : null,
      status:       ClubStatus.PENDING,
      createdById:  req.user.id,
    },
  });

  // Notify admin room of new pending club
  emitToAdmin("admin:new_pending", { type: "club", id: club.id, title: club.name });

  return res.status(201).json({ club, message: "Club request submitted. Awaiting admin approval." });
};

// ── UC-2.2 — Approve Club ────────────────────────────────────────────────────

export const approveClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) return res.status(404).json({ error: "Club not found" });
  if (club.status !== ClubStatus.PENDING) {
    return res.status(400).json({ error: "Club is not pending approval" });
  }

  const updated = await prisma.club.update({
    where: { id },
    data: { status: ClubStatus.ACTIVE, approvalNote: null },
  });

  await prisma.clubMembership.upsert({
    where: { clubId_userId: { clubId: id, userId: club.createdById } },
    create: { clubId: id, userId: club.createdById, role: ClubRole.PRESIDENT, status: MembershipStatus.APPROVED },
    update: { role: ClubRole.PRESIDENT, status: MembershipStatus.APPROVED },
  });

  const creator = await prisma.user.findUnique({ where: { id: club.createdById } });
  if (creator?.role === Role.STUDENT) {
    await prisma.user.update({ where: { id: club.createdById }, data: { role: Role.CLUB_OFFICER } });
  }

  void createNotification(
    club.createdById,
    "CLUB_APPROVED",
    "Club Approved",
    `Your club "${club.name}" has been approved and is now active!`,
    `/clubs/${updated.slug}`
  );

  void awardPoints(club.createdById, "CLUB_CREATED");
  void auditLog(req.user.id, "APPROVE_CLUB", "Club", id, { clubName: club.name }, req.ip);

  return res.json({ club: updated, message: "Club approved successfully" });
};

// ── UC-2.2 — Reject Club ─────────────────────────────────────────────────────

export const rejectClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const parsed = rejectSchema.safeParse(req.body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;

  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) return res.status(404).json({ error: "Club not found" });

  const updated = await prisma.club.update({
    where: { id },
    data: { status: ClubStatus.REJECTED, approvalNote: note },
  });

  void createNotification(
    club.createdById,
    "CLUB_REJECTED",
    "Club Request Rejected",
    note
      ? `Your club request for "${club.name}" was rejected. Reason: ${note}`
      : `Your club request for "${club.name}" has been rejected.`
  );

  void auditLog(req.user.id, "REJECT_CLUB", "Club", id, { note, clubName: club.name }, req.ip);
  return res.json({ club: updated, message: "Club request rejected" });
};

// ── UC-7.3 — Deactivate Club ─────────────────────────────────────────────────

export const deactivateClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const updated = await prisma.club.update({
    where: { id },
    data: { status: ClubStatus.INACTIVE },
  });
  return res.json({ club: updated, message: "Club deactivated" });
};

// ── UC-2.11 — Update Club Information ────────────────────────────────────────

export const updateClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const officer = await isClubOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can update club info" });

  const parsed = updateClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { name, description, category, contactEmail, phone, socialLinks, tags, logoUrl, bannerUrl } = parsed.data;
  const data: Record<string, unknown> = {};

  if (name        !== undefined) { data["name"] = name; data["slug"] = await uniqueSlug(name, id); }
  if (description !== undefined) data["description"]  = description;
  if (category    !== undefined) data["category"]     = category;
  if (contactEmail!== undefined) data["contactEmail"] = contactEmail || null;
  if (phone       !== undefined) data["phone"]        = phone       || null;
  if (socialLinks !== undefined) data["socialLinks"]  = socialLinks;
  if (tags        !== undefined) data["tags"]         = tags;
  if (logoUrl     !== undefined) data["logoUrl"]      = logoUrl     || null;
  if (bannerUrl   !== undefined) data["bannerUrl"]    = bannerUrl   || null;

  const club = await prisma.club.update({ where: { id }, data });
  return res.json({ club, message: "Club updated successfully" });
};

// ── List Members ──────────────────────────────────────────────────────────────

export const listMembers: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id     = req.params["id"] as string;
  const status = req.query["status"] as MembershipStatus | undefined;

  const officer = await isClubOfficer(req.user.id, req.user.role, id);

  const memberships = await prisma.clubMembership.findMany({
    where: {
      clubId: id,
      ...(officer
        ? status ? { status } : {}
        : { status: MembershipStatus.APPROVED }),
    },
    select: MEMBER_SELECT,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return res.json({ memberships });
};

// ── UC-2.7 — Request Membership ──────────────────────────────────────────────

export const requestMembership: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const parsed  = membershipReqSchema.safeParse(req.body);
  const message = parsed.success ? (parsed.data.message ?? null) : null;

  const club = await prisma.club.findUnique({ where: { id } });
  if (!club || club.status !== ClubStatus.ACTIVE) {
    return res.status(404).json({ error: "Club not found or not active" });
  }

  const existing = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId: id, userId: req.user.id } },
  });

  if (existing) {
    if (existing.status === MembershipStatus.APPROVED)
      return res.status(409).json({ error: "You are already a member" });
    if (existing.status === MembershipStatus.PENDING)
      return res.status(409).json({ error: "You already have a pending request" });
    // REJECTED → allow re-request
    const updated = await prisma.clubMembership.update({
      where: { clubId_userId: { clubId: id, userId: req.user.id } },
      data: { status: MembershipStatus.PENDING, message },
    });
    return res.json({ membership: updated, message: "Membership re-requested" });
  }

  const membership = await prisma.clubMembership.create({
    data: { clubId: id, userId: req.user.id, message },
  });
  return res.status(201).json({ membership, message: "Membership request submitted" });
};

// ── UC-2.8 — Approve Membership ──────────────────────────────────────────────

export const approveMembership: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id     = req.params["id"]     as string;
  const userId = req.params["userId"] as string;

  const officer = await isClubOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can approve memberships" });

  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId: id, userId } },
  });
  if (!m) return res.status(404).json({ error: "Membership request not found" });

  const club = await prisma.club.findUnique({ where: { id }, select: { name: true, slug: true } });

  const updated = await prisma.clubMembership.update({
    where: { clubId_userId: { clubId: id, userId } },
    data: { status: MembershipStatus.APPROVED, role: ClubRole.MEMBER },
    select: MEMBER_SELECT,
  });

  void createNotification(
    userId,
    "MEMBERSHIP_APPROVED",
    "Membership Approved",
    `Your membership request to "${club?.name ?? "a club"}" has been approved. Welcome aboard!`,
    club?.slug ? `/clubs/${club.slug}` : undefined
  );

  void awardPoints(userId, "CLUB_JOINED");

  // U12.3 — Fire Slack/Discord webhook for new member
  if (club) {
    const newMember = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    void fireWebhooks(id, "NEW_MEMBER", {
      message: `${newMember?.name ?? "A new member"} joined the club`,
      link: `${process.env.FRONTEND_URL ?? "http://127.0.0.1:3000"}/clubs/${club.slug}`,
    }, club.name);
  }

  return res.json({ membership: updated, message: "Membership approved" });
};

// ── UC-2.8 — Reject Membership ───────────────────────────────────────────────

export const rejectMembership: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id     = req.params["id"]     as string;
  const userId = req.params["userId"] as string;

  const officer = await isClubOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can reject memberships" });

  const clubForNotif = await prisma.club.findUnique({ where: { id }, select: { name: true } });

  const updated = await prisma.clubMembership.update({
    where: { clubId_userId: { clubId: id, userId } },
    data: { status: MembershipStatus.REJECTED },
    select: MEMBER_SELECT,
  });

  void createNotification(
    userId,
    "MEMBERSHIP_REJECTED",
    "Membership Request Rejected",
    `Your membership request to "${clubForNotif?.name ?? "a club"}" has been declined.`
  );

  return res.json({ membership: updated, message: "Membership rejected" });
};

// ── UC-2.9 / UC-2.12 — Update Member Role ────────────────────────────────────

export const updateMemberRole: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id     = req.params["id"]     as string;
  const userId = req.params["userId"] as string;

  const parsed = roleUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid role" });

  const isAdmin = req.user.role === Role.UNIVERSITY_ADMIN || req.user.role === Role.SYSTEM_ADMIN;
  const myMembership = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId: id, userId: req.user.id } },
  });
  const isPresident = myMembership?.role === ClubRole.PRESIDENT && myMembership.status === MembershipStatus.APPROVED;

  if (!isAdmin && !isPresident) {
    return res.status(403).json({ error: "Only club president can change member roles" });
  }

  const updated = await prisma.clubMembership.update({
    where: { clubId_userId: { clubId: id, userId } },
    data: { role: parsed.data.role },
    select: MEMBER_SELECT,
  });

  if (parsed.data.role !== ClubRole.MEMBER) {
    await prisma.user.updateMany({
      where: { id: userId, role: Role.STUDENT },
      data: { role: Role.CLUB_OFFICER },
    });
  }

  return res.json({ membership: updated, message: "Member role updated" });
};

// ── UC-2.10 — Leave / Remove Member ─────────────────────────────────────────

export const removeMember: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id     = req.params["id"]     as string;
  const userId = req.params["userId"] as string;

  const isSelf  = req.user.id === userId;
  const officer = await isClubOfficer(req.user.id, req.user.role, id);

  if (!isSelf && !officer) {
    return res.status(403).json({ error: "You cannot remove this member" });
  }

  if (isSelf) {
    const m = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: id, userId } },
    });
    if (m?.role === ClubRole.PRESIDENT) {
      const otherPresidents = await prisma.clubMembership.count({
        where: {
          clubId: id,
          role:   ClubRole.PRESIDENT,
          status: MembershipStatus.APPROVED,
          userId: { not: userId },
        },
      });
      if (otherPresidents === 0) {
        return res.status(400).json({
          error: "You are the only president. Transfer the role before leaving.",
        });
      }
    }
  }

  await prisma.clubMembership.delete({
    where: { clubId_userId: { clubId: id, userId } },
  });

  return res.json({ message: isSelf ? "You have left the club" : "Member removed successfully" });
};

// ── U4 — Follow / Unfollow Club ──────────────────────────────────────────────

export const followClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const clubId = req.params["id"] as string;
  const userId = req.user.id;

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return res.status(404).json({ error: "Club not found" });

  await prisma.clubFollow.upsert({
    where: { userId_clubId: { userId, clubId } },
    create: { userId, clubId },
    update: {},
  });

  const count = await prisma.clubFollow.count({ where: { clubId } });
  return res.json({ following: true, followerCount: count });
};

export const unfollowClub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const clubId = req.params["id"] as string;
  const userId = req.user.id;

  await prisma.clubFollow.deleteMany({ where: { userId, clubId } });

  const count = await prisma.clubFollow.count({ where: { clubId } });
  return res.json({ following: false, followerCount: count });
};
