"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { run } from "./helpers";

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
