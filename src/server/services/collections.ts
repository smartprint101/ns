import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyAll, type CurrentUser } from "./shared";
import { bnMoney } from "@/lib/bn";

const { courierCollections, payments, accountTransactions, accounts } = schema;

const createSchema = z.object({
  title: z.string().trim().min(2, "কুরিয়ার/বিবরণ লিখুন"),
  expectedAmount: z.coerce.number().positive("কত টাকা আসার কথা দিন"),
  date: z.coerce.date().optional(),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function createCollection(actor: CurrentUser, input: unknown) {
  const data = createSchema.parse(input);
  const db = await getDb();
  const [row] = await db
    .insert(courierCollections)
    .values({
      title: data.title,
      expectedAmount: data.expectedAmount,
      date: data.date ?? new Date(),
      notes: data.notes || null,
      createdById: actor.id,
      status: "PENDING",
    })
    .returning();
  await logEvent(db, {
    entity: "COLLECTION",
    entityId: row.id,
    action: "CREATED",
    detail: `${data.title} — প্রত্যাশিত ${bnMoney(data.expectedAmount)}`,
    actorId: actor.id,
  });
  await notifyAll(db, actor.id, {
    type: "COLLECTION",
    message: `${actor.name}: কুরিয়ার কালেকশন আনা বাকি ${bnMoney(data.expectedAmount)} (${data.title})`,
    link: "/collections",
  });
  return row;
}

const receiveSchema = z.object({
  id: z.string().min(1),
  receivedAmount: z.coerce.number().positive("কত টাকা এলো দিন"),
  accountId: z.string().min(1, "টাকা কোথায় জমা হলো বেছে নিন"),
});

export async function receiveCollection(actor: CurrentUser, input: unknown) {
  const data = receiveSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [col] = await tx.select().from(courierCollections).where(eq(courierCollections.id, data.id)).limit(1).for("update");
    if (!col) throw new BizError("কালেকশন পাওয়া যায়নি");
    if (col.status !== "PENDING") throw new BizError("এই কালেকশন আর বাকি নেই");
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, data.accountId), eq(accounts.active, true))).limit(1);
    if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");

    const [payment] = await tx
      .insert(payments)
      .values({
        amount: data.receivedAmount,
        accountId: account.id,
        source: "COURIER_COLLECTION",
        date: new Date(),
        notes: `কুরিয়ার কালেকশন — ${col.title}`,
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();
    await tx.insert(accountTransactions).values({
      accountId: account.id,
      amount: data.receivedAmount,
      kind: "PAYMENT_IN",
      paymentId: payment.id,
      note: `কুরিয়ার কালেকশন — ${col.title}`,
      date: new Date(),
    });
    await tx
      .update(courierCollections)
      .set({
        status: "RECEIVED",
        receivedAmount: data.receivedAmount,
        receivedAt: new Date(),
        receivedById: actor.id,
        accountId: account.id,
        paymentId: payment.id,
      })
      .where(eq(courierCollections.id, data.id));
    await logEvent(tx, {
      entity: "COLLECTION",
      entityId: data.id,
      action: "RECEIVED",
      detail: `প্রত্যাশিত ${bnMoney(col.expectedAmount)} · রিসিভ ${bnMoney(data.receivedAmount)} (${account.nameBn})`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "COLLECTION",
      message: `${actor.name}: কুরিয়ার কালেকশন ${bnMoney(data.receivedAmount)} রিসিভ করেছেন (${col.title})`,
      link: "/collections",
    });
  });
}

export async function cancelCollection(actor: CurrentUser, id: string) {
  const db = await getDb();
  const [col] = await db.select().from(courierCollections).where(eq(courierCollections.id, id)).limit(1);
  if (!col) throw new BizError("কালেকশন পাওয়া যায়নি");
  if (col.status !== "PENDING") throw new BizError("এই কালেকশন আর বাকি নেই");
  await db.update(courierCollections).set({ status: "CANCELLED" }).where(eq(courierCollections.id, id));
  await logEvent(db, { entity: "COLLECTION", entityId: id, action: "CANCELLED", actorId: actor.id });
}

export async function listCollections(opts: { tab: "pending" | "done" }) {
  const db = await getDb();
  if (opts.tab === "pending") {
    return db
      .select({
        collection: courierCollections,
        createdByName: schema.users.name,
        receivedByName: sql<string | null>`null`,
        accountName: sql<string | null>`null`,
      })
      .from(courierCollections)
      .innerJoin(schema.users, eq(schema.users.id, courierCollections.createdById))
      .where(eq(courierCollections.status, "PENDING"))
      .orderBy(asc(courierCollections.createdAt)); // oldest pending first
  }
  const rows = await db
    .select({
      collection: courierCollections,
      createdByName: schema.users.name,
      receivedByName: sql<string | null>`rb.name`,
      accountName: accounts.nameBn,
    })
    .from(courierCollections)
    .innerJoin(schema.users, eq(schema.users.id, courierCollections.createdById))
    .leftJoin(sql`${schema.users} as rb`, sql`rb.id = ${courierCollections.receivedById}`)
    .leftJoin(accounts, eq(accounts.id, courierCollections.accountId))
    .where(sql`${courierCollections.status} != 'PENDING'`)
    .orderBy(desc(courierCollections.updatedAt))
    .limit(200);
  return rows;
}

export async function pendingCollectionSummary() {
  const db = await getDb();
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      sum: sql<number>`coalesce(sum(${courierCollections.expectedAmount})::float8, 0)`,
    })
    .from(courierCollections)
    .where(eq(courierCollections.status, "PENDING"));
  return { count: row?.count ?? 0, sum: row?.sum ?? 0 };
}
