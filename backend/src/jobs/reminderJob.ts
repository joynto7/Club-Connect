import cron from "node-cron";
import { NotificationType } from "@prisma/client";
import prisma from "../prisma.ts";
import { createNotification } from "../services/notificationService.ts";
import { logger } from "../lib/logger.ts";

export function startReminderJob() {
  // Run every minute — check for reminders due in the next 2 minutes
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const maxOffset = 24 * 60 * 60_000; // look ahead 24h

      const reminders = await prisma.eventReminder.findMany({
        where: {
          sent: false,
          event: {
            startsAt: {
              gte: now,
              lte: new Date(now.getTime() + maxOffset),
            },
          },
        },
        include: {
          event: { select: { id: true, title: true, startsAt: true, location: true } },
          user: { select: { id: true } },
        },
      });

      for (const r of reminders) {
        const triggerAt = new Date(r.event.startsAt.getTime() - r.minutesBefore * 60_000);
        if (now >= triggerAt) {
          const label =
            r.minutesBefore === 1440 ? "1 day"
            : r.minutesBefore === 60 ? "1 hour"
            : "15 minutes";

          void createNotification(
            r.userId,
            NotificationType.EVENT_REMINDER,
            "Event Starting Soon",
            `"${r.event.title}" starts in ${label} at ${r.event.location}.`,
            `/events/${r.event.id}`
          );

          await prisma.eventReminder.update({ where: { id: r.id }, data: { sent: true } });
        }
      }
    } catch (err) {
      // A transient DB blip here must never take down the whole process —
      // process.on("unhandledRejection") in index.ts exits on any unhandled rejection.
      logger.error("reminderJob tick failed", { error: err instanceof Error ? err.message : String(err) });
    }
  });
}
