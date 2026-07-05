import prisma from "../prisma.ts";

export type WebhookEvent = "NEW_EVENT" | "NEW_MEMBER" | "ANNOUNCEMENT";

interface WebhookPayload {
  clubName: string;
  message: string;
  link: string;
  color?: number; // Discord embed color (decimal)
}

async function postWebhook(webhookUrl: string, type: string, payload: WebhookPayload): Promise<void> {
  try {
    const isDiscord = type === "DISCORD";
    const body = isDiscord
      ? JSON.stringify({
          embeds: [
            {
              title: payload.clubName,
              description: payload.message,
              url: payload.link,
              color: payload.color ?? 0xeba814,
            },
          ],
        })
      : JSON.stringify({
          text: `*${payload.clubName}*: ${payload.message} — ${payload.link}`,
        });

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Fire-and-forget — swallow errors so they never block the calling request
  }
}

export async function fireWebhooks(
  clubId: string,
  event: WebhookEvent,
  payload: Omit<WebhookPayload, "clubName">,
  clubName: string
): Promise<void> {
  try {
    const integrations = await prisma.clubIntegration.findMany({
      where: { clubId, events: { has: event } },
    });

    for (const integration of integrations) {
      void postWebhook(integration.webhookUrl, integration.type, {
        ...payload,
        clubName,
      });
    }
  } catch {
    // Never block calling request
  }
}
