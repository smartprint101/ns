import { z } from "zod";
import { asc, desc, eq, sql, and } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, type CurrentUser, logEvent } from "./shared";
import { m2 } from "@/lib/utils";

export type AccountWithBalance = {
  id: string;
  key: string;
  nameBn: string;
  kind: "CASH" | "BANK" | "MOBILE";
  openingBalance: number;
  balance: number;
  active: boolean;
  sortOrder: number;
};

/** Balance = openingBalance + Σ signed transactions (no manual balance edits). */
export async function listAccountsWithBalances(dbIn?: Awaited<ReturnType<typeof getDb>>): Promise<AccountWithBalance[]> {
  const db = dbIn ?? (await getDb());
  const rows = await db
    .select({
      id: schema.accounts.id,
      key: schema.accounts.key,
      nameBn: schema.accounts.nameBn,
      kind: schema.accounts.kind,
      openingBalance: schema.accounts.openingBalance,
      active: schema.accounts.active,
      sortOrder: schema.accounts.sortOrder,
      txSum: sql<number>`coalesce((select sum(${schema.accountTransactions.amount})::float8 from ${schema.accountTransactions} at where at.account_id = "accounts"."id"), 0)`,
    })
    .from(schema.accounts)
    .where(eq(schema.accounts.active, true))
    .orderBy(asc(schema.accounts.sortOrder));
  return rows.map((r) => ({ ...r, balance: m2(r.openingBalance + r.txSum) }));
}

export async function listAccountTransactions(accountId: string, limit = 60) {
  const db = await getDb();
  return db
    .select()
    .from(schema.accountTransactions)
    .where(eq(schema.accountTransactions.accountId, accountId))
    .orderBy(desc(schema.accountTransactions.date), desc(schema.accountTransactions.createdAt))
    .limit(limit);
}

const adjustmentSchema = z.object({
  accountId: z.string().min(1, "অ্যাকাউন্ট বেছে নিন"),
  amount: z.coerce.number().refine((v) => v !== 0, "পরিমাণ ০ হতে পারবে না"),
  reason: z.string().trim().min(3, "কারণ লিখুন"),
});

/** OWNER only. Manually correct an account — always as an explicit adjustment transaction. */
export async function createAdjustment(actor: CurrentUser, input: { accountId: string; amount: number; reason: string }) {
  if (actor.role !== "OWNER") throw new BizError("শুধু Owner অ্যাজাস্টমেন্ট করতে পারবেন");
  const data = adjustmentSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, data.accountId)).limit(1);
    if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");
    const [adj] = await tx
      .insert(schema.adjustments)
      .values({ accountId: account.id, amount: m2(data.amount), reason: data.reason, createdById: actor.id })
      .returning();
    await tx.insert(schema.accountTransactions).values({
      accountId: account.id,
      amount: m2(data.amount),
      kind: "ADJUSTMENT",
      adjustmentId: adj.id,
      note: data.reason,
    });
    await logEvent(tx, {
      entity: "ACCOUNT",
      entityId: account.id,
      action: "ADJUSTMENT",
      detail: `${account.nameBn}: ${data.amount >= 0 ? "+" : ""}${data.amount} — ${data.reason}`,
      actorId: actor.id,
    });
    return adj;
  });
}

const accountSchema = z.object({
  nameBn: z.string().trim().min(2, "ব্যাংক/মাধ্যমের নাম দিন"),
  kind: z.enum(["CASH", "BANK", "MOBILE"]),
  openingBalance: z.coerce.number().min(0).default(0),
});

/** OWNER only — add another bank/mobile account later (e.g. a new bank). */
export async function createAccount(actor: CurrentUser, input: { nameBn: string; kind: "CASH" | "BANK" | "MOBILE"; openingBalance?: number }) {
  if (actor.role !== "OWNER") throw new BizError("শুধু Owner নতুন অ্যাকাউন্ট যোগ করতে পারবেন");
  const data = accountSchema.parse(input);
  const db = await getDb();
  const key = data.nameBn
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9ঀ-৿]+/g, "_")
    .slice(0, 32);
  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${schema.accounts.sortOrder}),0)` })
    .from(schema.accounts);
  const [row] = await db
    .insert( schema.accounts)
    .values({ key, nameBn: data.nameBn, kind: data.kind, openingBalance: m2(data.openingBalance ?? 0), sortOrder: maxSort + 1 })
    .returning();
  if (m2(data.openingBalance ?? 0) !== 0) {
    // Opening balance lands as an adjustment so balance math stays transaction-based
    await db.insert(schema.adjustments).values({
      accountId: row.id,
      amount: m2(data.openingBalance ?? 0),
      reason: "প্রারম্ভিক ব্যালান্স",
      createdById: actor.id,
    });
    await db.insert(schema.accountTransactions).values({
      accountId: row.id,
      amount: m2(data.openingBalance ?? 0),
      kind: "ADJUSTMENT",
      note: "প্রারম্ভিক ব্যালান্স",
    });
  }
  return row;
}
