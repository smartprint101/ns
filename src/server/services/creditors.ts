import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyAll, type CurrentUser } from "./shared";
import { bnMoney } from "@/lib/bn";
import { m2 } from "@/lib/utils";

const { creditors } = schema;

const creditorSchema = z.object({
  name: z.string().trim().min(2, "পাওনাদারের নাম লিখুন"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  amount: z.coerce.number().positive("কত টাকা পাবে লিখুন").max(1_000_000_000),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreditorInput = z.infer<typeof creditorSchema>;

export async function createCreditor(actor: CurrentUser, input: unknown) {
  const data = creditorSchema.parse(input);
  const db = await getDb();
  const amount = m2(data.amount);
  const [row] = await db
    .insert(creditors)
    .values({
      name: data.name,
      phone: data.phone || null,
      amount,
      notes: data.notes || null,
      status: "ACTIVE",
      createdById: actor.id,
      updatedById: actor.id,
    })
    .returning();

  await logEvent(db, {
    entity: "CREDITOR",
    entityId: row.id,
    action: "CREATED",
    detail: `${data.name} পাবে ${bnMoney(amount)}`,
    actorId: actor.id,
  });
  await notifyAll(db, actor.id, {
    type: "CREDITOR",
    message: `${actor.name}: পাওনাদার যোগ করেছেন — ${data.name} পাবে ${bnMoney(amount)}`,
    link: "/creditors",
  });
  return row;
}

export async function settleCreditor(actor: CurrentUser, id: string) {
  const db = await getDb();
  const [row] = await db.select().from(creditors).where(eq(creditors.id, id)).limit(1);
  if (!row) throw new BizError("পাওনাদার পাওয়া যায়নি");
  if (row.status !== "ACTIVE") throw new BizError("এই পাওনাদার এন্ট্রি আর সক্রিয় নেই");
  await db.update(creditors).set({ status: "COMPLETED", updatedById: actor.id }).where(eq(creditors.id, id));
  await logEvent(db, {
    entity: "CREDITOR",
    entityId: id,
    action: "COMPLETED",
    detail: `${row.name} — ${bnMoney(row.amount)} পাওনা বন্ধ/পরিশোধ`,
    actorId: actor.id,
  });
}

export async function listCreditors(opts: { q?: string } = {}) {
  const db = await getDb();
  const conds = [eq(creditors.status, "ACTIVE")];
  const like = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  if (like) conds.push(or(ilike(creditors.name, like), ilike(creditors.phone, like), ilike(creditors.notes, like))!);

  return db
    .select({
      creditor: creditors,
      createdByName: schema.users.name,
    })
    .from(creditors)
    .innerJoin(schema.users, eq(schema.users.id, creditors.createdById))
    .where(and(...conds))
    .orderBy(desc(creditors.createdAt))
    .limit(300);
}

export async function creditorSummary() {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${creditors.amount})::float8, 0)` })
    .from(creditors)
    .where(eq(creditors.status, "ACTIVE"));
  return { count: row?.count ?? 0, sum: m2(row?.sum ?? 0) };
}
