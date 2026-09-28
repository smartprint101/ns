import { z } from "zod";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, findSimilarExpenses, logEvent, notifyAll, type DuplicateMatch, type CurrentUser } from "./shared";
import { bnMoney } from "@/lib/bn";
import { EXPENSE_CATEGORY_BN } from "@/lib/labels";
import { m2 } from "@/lib/utils";

const { expenses, accountTransactions, accounts } = schema;

const expenseSchema = z.object({
  amount: z.coerce.number().positive("খরচের পরিমাণ দিন").max(1_000_000_000),
  category: z.enum(["FACTORY", "PURCHASE", "COURIER", "PACKAGING", "TRANSPORT", "OTHER"]),
  description: z.string().trim().min(2, "বিবরণ লিখুন"),
  date: z.coerce.date().optional(),
  accountId: z.string().min(1, "পেমেন্ট মেথড বেছে নিন"),
  partyId: z.string().optional().or(z.literal("")),
  factoryId: z.string().optional().or(z.literal("")),
  regularOrderId: z.string().optional().or(z.literal("")),
  packagingOrderId: z.string().optional().or(z.literal("")),
  taskId: z.string().optional().or(z.literal("")),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export type CreateExpenseResult =
  | { ok: true; expenseId: string }
  | { ok: false; duplicateWarning: { message: string; matches: DuplicateMatch[] } };

export async function createExpense(actor: CurrentUser, rawInput: unknown, opts?: { confirmed?: boolean }): Promise<CreateExpenseResult> {
  const data = expenseSchema.parse(rawInput);
  const db = await getDb();

  if (!opts?.confirmed) {
    const matches = await findSimilarExpenses(db, { createdById: actor.id, amount: data.amount, description: data.description });
    if (matches.length > 0) {
      return {
        ok: false,
        duplicateWarning: {
          message: "একই বিবরণ ও পরিমাণের একটি খরচ সাম্প্রতিক সময়ে দেওয়া হয়েছে — আপনি কি নিশ্চিত?",
          matches,
        },
      };
    }
  }

  const expense = await db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, data.accountId), eq(accounts.active, true))).limit(1);
    if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");
    const [expense] = await tx
      .insert(expenses)
      .values({
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date ?? new Date(),
        accountId: account.id,
        partyId: data.partyId || null,
        factoryId: data.factoryId || null,
        regularOrderId: data.regularOrderId || null,
        packagingOrderId: data.packagingOrderId || null,
        taskId: data.taskId || null,
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();
    await tx.insert(accountTransactions).values({
      accountId: account.id,
      amount: m2(-data.amount),
      kind: "EXPENSE_OUT",
      expenseId: expense.id,
      note: `${EXPENSE_CATEGORY_BN[data.category]} — ${data.description}`,
      date: expense.date,
    });
    const detail = `${EXPENSE_CATEGORY_BN[data.category]} ${bnMoney(data.amount)} (${account.nameBn}) — ${data.description}`;
    if (data.regularOrderId)
      await logEvent(tx, { entity: "REGULAR_ORDER", entityId: data.regularOrderId, action: "EXPENSE", detail, actorId: actor.id });
    if (data.packagingOrderId)
      await logEvent(tx, { entity: "PACKAGING_ORDER", entityId: data.packagingOrderId, action: "EXPENSE", detail, actorId: actor.id });
    if (data.taskId) await logEvent(tx, { entity: "TASK", entityId: data.taskId, action: "EXPENSE", detail, actorId: actor.id });
    await logEvent(tx, { entity: "EXPENSE", entityId: expense.id, action: "CREATED", detail, actorId: actor.id });
    await notifyAll(tx, actor.id, {
      type: "EXPENSE",
      message: `${actor.name}: খরচ ${bnMoney(data.amount)} — ${data.description}`,
      link: "/expenses",
    });
    return expense;
  });

  return { ok: true, expenseId: expense.id };
}

export async function voidExpense(actor: CurrentUser, expenseId: string, reason: string) {
  if (!reason || reason.trim().length < 2) throw new BizError("কারণ লিখুন");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [expense] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1).for("update");
    if (!expense) throw new BizError("খরচ পাওয়া যায়নি");
    if (expense.voidedAt) throw new BizError("এই খরচ ইতোমধ্যে বাতিল");
    await tx
      .update(expenses)
      .set({ voidedAt: new Date(), voidReason: reason.trim(), updatedById: actor.id })
      .where(eq(expenses.id, expenseId));
    await tx.insert(accountTransactions).values({
      accountId: expense.accountId,
      amount: expense.amount,
      kind: "EXPENSE_REVERSAL",
      expenseId: expense.id,
      note: `খরচ বাতিল — ${reason.trim()}`,
    });
    await logEvent(tx, {
      entity: "EXPENSE",
      entityId: expenseId,
      action: "VOIDED",
      detail: `${bnMoney(expense.amount)} বাতিল — ${reason.trim()}`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "EXPENSE",
      message: `${actor.name}: খরচ ${bnMoney(expense.amount)} বাতিল করেছেন`,
      link: "/expenses",
    });
  });
}

export async function listExpenses(opts: { q?: string; category?: string; accountId?: string; from?: Date; to?: Date }) {
  const db = await getDb();
  const conds = [];
  if (opts.category) conds.push(eq(expenses.category, opts.category as never));
  if (opts.accountId) conds.push(eq(expenses.accountId, opts.accountId));
  if (opts.from) conds.push(gte(expenses.date, opts.from));
  if (opts.to) conds.push(lte(expenses.date, opts.to));
  const like = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  if (like) {
    conds.push(
      or(
        ilike(expenses.description, like),
        sql`exists (select 1 from ${schema.packagingParties} p where p.id = ${expenses.partyId} and p.name ilike ${like})`,
        sql`exists (select 1 from ${schema.factories} f where f.id = ${expenses.factoryId} and f.name ilike ${like})`
      )!
    );
  }
  return db
    .select({
      expense: expenses,
      account: accounts,
      party: schema.packagingParties,
      factory: schema.factories,
      regularOrderNo: schema.regularOrders.orderNo,
      packagingOrderNo: schema.packagingOrders.orderNo,
      taskTitle: schema.tasks.title,
      createdByName: schema.users.name,
    })
    .from(expenses)
    .innerJoin(accounts, eq(accounts.id, expenses.accountId))
    .leftJoin(schema.packagingParties, eq(schema.packagingParties.id, expenses.partyId))
    .leftJoin(schema.factories, eq(schema.factories.id, expenses.factoryId))
    .leftJoin(schema.regularOrders, eq(schema.regularOrders.id, expenses.regularOrderId))
    .leftJoin(schema.packagingOrders, eq(schema.packagingOrders.id, expenses.packagingOrderId))
    .leftJoin(schema.tasks, eq(schema.tasks.id, expenses.taskId))
    .innerJoin(schema.users, eq(schema.users.id, expenses.createdById))
    .where(and(...conds))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))
    .limit(300);
}
