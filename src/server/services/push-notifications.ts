import webPush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@/server/db";
import type { AnyDb } from "./shared";

const SETTINGS_ID = "web-push";
const DEFAULT_SUBJECT = "mailto:admin@ns-traders.app";

type PushMessage = { type: string; message: string; link?: string | null };
type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

async function getOrCreateVapidKeys(db: AnyDb) {
  const existing = await db.query.pushSettings.findFirst({
    where: eq(schema.pushSettings.id, SETTINGS_ID),
  });
  if (existing) return existing;

  const generated = webPush.generateVAPIDKeys();
  await db
    .insert(schema.pushSettings)
    .values({
      id: SETTINGS_ID,
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    })
    .onConflictDoNothing({ target: schema.pushSettings.id });

  const saved = await db.query.pushSettings.findFirst({
    where: eq(schema.pushSettings.id, SETTINGS_ID),
  });
  if (!saved) throw new Error("Push notification keys could not be initialized");
  return saved;
}

export async function getPushPublicKey(db: AnyDb): Promise<string> {
  return (await getOrCreateVapidKeys(db)).publicKey;
}

export async function savePushSubscription(db: AnyDb, userId: string, subscription: BrowserSubscription): Promise<void> {
  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date(),
      },
    });
}

export async function removePushSubscription(db: AnyDb, userId: string, endpoint: string): Promise<void> {
  await db
    .delete(schema.pushSubscriptions)
    .where(and(eq(schema.pushSubscriptions.userId, userId), eq(schema.pushSubscriptions.endpoint, endpoint)));
}

/** Deliver an already-created in-app notification to every enabled device. */
export async function sendPushToUsers(db: AnyDb, userIds: string[], notification: PushMessage): Promise<void> {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return;

  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(inArray(schema.pushSubscriptions.userId, recipients));
  if (subscriptions.length === 0) return;

  const keys = await getOrCreateVapidKeys(db);
  webPush.setVapidDetails(process.env.VAPID_SUBJECT || DEFAULT_SUBJECT, keys.publicKey, keys.privateKey);

  const payload = JSON.stringify({
    title: "এনএস ট্রেডার্স",
    body: notification.message,
    url: notification.link || "/notifications",
    tag: `${notification.type}-${Date.now()}`,
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 60 * 60 * 24, urgency: "high" }
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, subscription.id));
          return;
        }
        console.error("[push] delivery failed", statusCode ?? error);
      }
    })
  );
}
