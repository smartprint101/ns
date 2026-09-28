"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { getPushPublicKey, removePushSubscription, savePushSubscription } from "@/server/services/push-notifications";
import { run } from "./helpers";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(1).max(1024),
    auth: z.string().min(1).max(1024),
  }),
});

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  return run(async () => {
    const db = await getDb();
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
  });
}

export async function getPushPublicKeyAction() {
  await requireUser();
  return run(async () => {
    const db = await getDb();
    return { publicKey: await getPushPublicKey(db) };
  });
}

export async function savePushSubscriptionAction(input: unknown) {
  const user = await requireUser();
  return run(async () => {
    const subscription = pushSubscriptionSchema.parse(input);
    const db = await getDb();
    await savePushSubscription(db, user.id, subscription);
  });
}

export async function removePushSubscriptionAction(endpoint: string) {
  const user = await requireUser();
  return run(async () => {
    const safeEndpoint = z.string().url().max(4096).parse(endpoint);
    const db = await getDb();
    await removePushSubscription(db, user.id, safeEndpoint);
  });
}

export async function listMyNotificationsAction(limit = 40) {
  const user = await requireUser();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    link: n.link,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  }));
}
