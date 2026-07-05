import prisma from "../prisma.ts";
import { createNotification } from "./notificationService.ts";

const ACHIEVEMENTS = [
  { slug: "first_event",      name: "First Event",       description: "Attend your first event",               icon: "🎉" },
  { slug: "regular",          name: "Regular",           description: "Attend 5 events",                        icon: "⭐" },
  { slug: "campus_legend",    name: "Campus Legend",     description: "Attend 25 events",                       icon: "🏆" },
  { slug: "club_founder",     name: "Club Founder",      description: "Get a club approved",                    icon: "🏛️" },
  { slug: "super_connector",  name: "Super Connector",   description: "Join 3 or more clubs",                   icon: "🔗" },
  { slug: "voice",            name: "Voice",             description: "Submit feedback for 3 events",           icon: "🎤" },
  { slug: "event_organizer",  name: "Event Organizer",   description: "Get an event approved",                  icon: "📋" },
] as const;

export async function seedAchievements() {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where:  { slug: a.slug },
      create: a,
      update: { name: a.name, description: a.description, icon: a.icon },
    });
  }
}

export async function checkAndUnlockAchievements(userId: string) {
  const [checkinCount, approvedClubs, memberships, feedbackCount, approvedEvents] = await Promise.all([
    prisma.eventAttendance.count({ where: { userId, checkedIn: true } }),
    prisma.club.count({ where: { createdById: userId, status: "ACTIVE" } }),
    prisma.clubMembership.count({ where: { userId, status: "APPROVED" } }),
    prisma.eventFeedback.count({ where: { userId } }),
    prisma.event.count({ where: { createdById: userId, status: "APPROVED" } }),
  ]);

  const conditions: Record<string, boolean> = {
    first_event:     checkinCount >= 1,
    regular:         checkinCount >= 5,
    campus_legend:   checkinCount >= 25,
    club_founder:    approvedClubs >= 1,
    super_connector: memberships  >= 3,
    voice:           feedbackCount >= 3,
    event_organizer: approvedEvents >= 1,
  };

  const owned = await prisma.userAchievement.findMany({
    where:  { userId },
    select: { achievementSlug: true },
  });
  const ownedSlugs = new Set(owned.map((u) => u.achievementSlug));

  for (const [slug, met] of Object.entries(conditions)) {
    if (!met || ownedSlugs.has(slug)) continue;

    await prisma.userAchievement.create({ data: { userId, achievementSlug: slug } });

    const achievement = ACHIEVEMENTS.find((a) => a.slug === slug);
    if (achievement) {
      void createNotification(
        userId,
        "ANNOUNCEMENT",
        `${achievement.icon} Achievement Unlocked: ${achievement.name}`,
        achievement.description,
        "/profile"
      );
    }
  }
}
