import { NotificationType } from "@prisma/client";
import prisma from "../prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import webpush from "web-push";

let vapidPublic  = process.env.VAPID_PUBLIC_KEY ?? "";
let vapidPrivate = process.env.VAPID_PRIVATE_KEY ?? "";
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@clubconnect.local";

if (vapidPublic && vapidPrivate) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (err) {
    console.warn("[notificationService] Invalid VAPID keys — web push disabled:", (err as Error).message);
    vapidPublic = "";
    vapidPrivate = "";
  }
}

async function sendPushToUser(userId: string, title: string, body: string, link?: string) {
  if (!vapidPublic || !vapidPrivate) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify({ title, body, link: link ?? "/notifications" });
    for (const sub of subs) {
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        .catch(async (err: { statusCode?: number }) => {
          // 410 = subscription expired/unsubscribed — remove it
          if (err.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
          }
        });
    }
  } catch {
    // never break the calling flow
  }
}

type PrefField = "eventUpdates" | "clubUpdates" | "bookingUpdates" | "announcements";

const typeToPreference: Record<NotificationType, PrefField> = {
  EVENT_APPROVED:          "eventUpdates",
  EVENT_REJECTED:          "eventUpdates",
  EVENT_CANCELLED:         "eventUpdates",
  EVENT_RSVP:              "eventUpdates",
  EVENT_WAITLIST_PROMOTED: "eventUpdates",
  EVENT_REMINDER:          "eventUpdates",
  CLUB_APPROVED:           "clubUpdates",
  CLUB_REJECTED:           "clubUpdates",
  MEMBERSHIP_APPROVED:     "clubUpdates",
  MEMBERSHIP_REJECTED:     "clubUpdates",
  BOOKING_APPROVED:        "bookingUpdates",
  BOOKING_REJECTED:        "bookingUpdates",
  ANNOUNCEMENT:            "announcements",
  PAYMENT_SUCCEEDED:       "eventUpdates",
};

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    const prefField = typeToPreference[type];
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (prefs && !prefs[prefField]) return;

    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link: link ?? null },
    });

    // Real-time socket notification
    emitToUser(userId, "notification:new", notification);
    // Web push notification
    void sendPushToUser(userId, title, message, link);
  } catch {
    // fire-and-forget — never break the calling request
  }
}

export async function createBulkNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const prefField = typeToPreference[type];
    let targets = userIds;

    if (prefField) {
      const disabled = await prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, [prefField]: false },
        select: { userId: true },
      });
      const disabledSet = new Set(disabled.map((p) => p.userId));
      targets = userIds.filter((id) => !disabledSet.has(id));
    }

    if (targets.length === 0) return;

    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        type,
        title,
        message,
        link: link ?? null,
      })),
    });

    // Real-time socket + web push to each user
    for (const userId of targets) {
      emitToUser(userId, "notification:new", { userId, type, title, message, link: link ?? null });
      void sendPushToUser(userId, title, message, link);
    }
  } catch {
    // fire-and-forget
  }
}
