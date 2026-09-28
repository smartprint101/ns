import { eq, and, isNull, gte, sql } from "drizzle-orm";
import type { DB } from "@/server/db";
import { schema } from "@/server/db";
import { ZodError } from "zod";
import { sendPushToUsers } from "./push-notifications";

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type AnyDb = DB | Tx;

export type CurrentUser = { id: string; name: string; role: "OWNER" | "STAFF" };

/** Business-logic error safe to show to users (Bengali message). */
export class BizError extends Error {}

export function friendlyError(e: unknown): string {
  if (e instanceof BizError) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message ?? "তথ্য ঠিক নেই";
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.includes("unique") || msg.includes("duplicate key")) return "এই নাম/তথ্য দিয়ে আগেই একটি এন্ট্রি আছে";
  console.error("[app-error]", e);
  return "একটি সমস্যা হয়েছে — আবার চেষ্টা করুন";
}

// ── Event log ────────────────────────────────────────────────────────────────
export async function logEvent(
  db: AnyDb,
  e: { entity: string; entityId: string; action: string; detail?: string; actorId?: string | null }
): Promise<void> {
  await db.insert(schema.eventLogs).values({
    entity: e.entity,
    entityId: e.entityId,
    action: e.action,
    detail: e.detail ?? null,
    actorId: e.actorId ?? null,
  });
}

// ── Notifications ────────────────────────────────────────────────────────────
export async function notifyAll(
  db: AnyDb,
  exceptUserId: string,
  n: { type: string; message: string; link?: string | null }
): Promise<void> {
  const users = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.active, true)));
  const rows = users.filter((u) => u.id !== exceptUserId).map((u) => ({ userId: u.id, ...n, link: n.link ?? null }));
  if (rows.length) {
    await db.insert(schema.notifications).values(rows);
    try {
      await sendPushToUsers(db, rows.map((row) => row.userId), n);
    } catch (error) {
      // A push-provider outage must never roll back the business action or in-app notification.
      console.error("[push] notification fan-out failed", error);
    }
  }
}

export async function notifyUser(
  db: AnyDb,
  userId: string,
  n: { type: string; message: string; link?: string | null }
): Promise<void> {
  await db.insert(schema.notifications).values({ userId, ...n, link: n.link ?? null });
  try {
    await sendPushToUsers(db, [userId], n);
  } catch (error) {
    console.error("[push] notification delivery failed", error);
  }
}

export async function unreadCount(db: AnyDb, userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return rows[0]?.count ?? 0;
}

// ── Duplicate detection (warning only, never a hard block) ──────────────────
export type DuplicateMatch = { id: string; amount: number; description: string; date: Date };

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function findSimilarExpenses(
  db: AnyDb,
  input: { createdById: string; amount: number; description: string }
): Promise<DuplicateMatch[]> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: schema.expenses.id,
      amount: schema.expenses.amount,
      description: schema.expenses.description,
      date: schema.expenses.date,
    })
    .from(schema.expenses)
    .where(
      and(
        eq(schema.expenses.createdById, input.createdById),
        isNull(schema.expenses.voidedAt),
        gte(schema.expenses.createdAt, cutoff)
      )
    );
  const target = norm(input.description);
  return rows.filter((r) => r.amount === input.amount && (norm(r.description) === target || norm(r.description).startsWith(target) || target.startsWith(norm(r.description))));
}

export async function findSimilarPayments(
  db: AnyDb,
  input: { createdById: string; amount: number; partyId?: string | null; customerId?: string | null; notes?: string | null }
): Promise<DuplicateMatch[]> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: schema.payments.id,
      amount: schema.payments.amount,
      notes: schema.payments.notes,
      date: schema.payments.date,
      partyId: schema.payments.partyId,
      customerId: schema.payments.customerId,
    })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.createdById, input.createdById),
        isNull(schema.payments.voidedAt),
        gte(schema.payments.createdAt, cutoff)
      )
    );
  const target = norm(input.notes ?? "");
  return rows
    .filter(
      (r) =>
        r.amount === input.amount &&
        r.partyId === (input.partyId ?? null) &&
        r.customerId === (input.customerId ?? null) &&
        (target === "" ? true : norm(r.notes ?? "") === target)
    )
    .map((r) => ({ id: r.id, amount: r.amount, description: r.notes ?? "পেমেন্ট", date: r.date }));
}
