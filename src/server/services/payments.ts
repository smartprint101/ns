import { z } from "zod";
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, findSimilarPayments, logEvent, notifyAll, type DuplicateMatch, type CurrentUser } from "./shared";
import { bnMoney } from "@/lib/bn";
import { m2 } from "@/lib/utils";

const { payments, paymentAllocations, accountTransactions, accounts, regularOrders, packagingOrders } = schema;

const allocationSchema = z
  .object({
    regularOrderId: z.string().optional().or(z.literal("")),
    packagingOrderId: z.string().optional().or(z.literal("")),
    amount: z.coerce.number().positive("অ্যালোকেশনের পরিমাণ ০-এর বেশি হতে হবে"),
  })
  .refine((a) => !!a.regularOrderId !== !!a.packagingOrderId, { message: "একটি অর্ডার বেছে নিন" });

const paymentSchema = z
  .object({
    amount: z.coerce.number().positive("পেমেন্টের পরিমাণ দিন").max(1_000_000_000),
    accountId: z.string().min(1, "পেমেন্ট মেথড বেছে নিন"),
    partyId: z.string().optional().or(z.literal("")),
    customerId: z.string().optional().or(z.literal("")),
    date: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    isAdvance: z.coerce.boolean().default(false),
    inCollections: z.coerce.boolean().default(false),
    allocations: z.array(allocationSchema).max(30).default([]),
  })
  .refine((d) => d.partyId || d.customerId, { message: "পার্টি বা কাস্টমার বেছে নিন" });
export type PaymentInput = z.infer<typeof paymentSchema>;

export type CreatePaymentResult =
  | { ok: true; paymentId: string; txnNo: number }
  | { ok: false; duplicateWarning: { message: string; matches: DuplicateMatch[] } };

export async function createPayment(actor: CurrentUser, rawInput: unknown, opts?: { confirmed?: boolean }): Promise<CreatePaymentResult> {
  const data = paymentSchema.parse(rawInput);
  const db = await getDb();

  if (!opts?.confirmed) {
    const matches = await findSimilarPayments(db, {
      createdById: actor.id,
      amount: data.amount,
      partyId: data.partyId || null,
      customerId: data.customerId || null,
      notes: data.notes || null,
    });
    if (matches.length > 0) {
      return {
        ok: false,
        duplicateWarning: {
          message: "এই পেমেন্টের মতো একটি এন্ট্রি আগে থেকেই আছে — আপনি কি নিশ্চিত?",
          matches,
        },
      };
    }
  }

  const totalAlloc = m2(data.allocations.reduce((s, a) => s + a.amount, 0));
  if (totalAlloc > data.amount + 0.009) throw new BizError("অর্ডারে বণ্টনের যোগফল পেমেন্টের পরিমাণের বেশি হতে পারবে না");

  const payment = await db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, data.accountId), eq(accounts.active, true))).limit(1);
    if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");

    // Validate allocations: order exists, active, and belongs to the payer.
    const allocRows: { regularOrderId: string | null; packagingOrderId: string | null; amount: number; label: string }[] = [];
    for (const a of data.allocations) {
      if (a.regularOrderId) {
        const [o] = await tx.select().from(regularOrders).where(eq(regularOrders.id, a.regularOrderId)).limit(1);
        if (!o) throw new BizError("রেগুলার অর্ডার পাওয়া যায়নি");
        if (o.status === "CANCELLED") throw new BizError(`অর্ডার #${o.orderNo} বাতিল — এতে পেমেন্ট বসানো যাবে না`);
        if (data.customerId && o.customerId !== data.customerId) throw new BizError(`অর্ডার #${o.orderNo} এই কাস্টমারের নয়`);
        allocRows.push({ regularOrderId: o.id, packagingOrderId: null, amount: a.amount, label: `#${o.orderNo}` });
      } else {
        const [o] = await tx.select().from(packagingOrders).where(eq(packagingOrders.id, a.packagingOrderId!)).limit(1);
        if (!o) throw new BizError("প্যাকেজিং অর্ডার পাওয়া যায়নি");
        if (o.status === "CANCELLED") throw new BizError(`PKG-${o.orderNo} বাতিল — এতে পেমেন্ট বসানো যাবে না`);
        if (data.partyId && o.partyId !== data.partyId) throw new BizError(`PKG-${o.orderNo} এই পার্টির নয়`);
        allocRows.push({ regularOrderId: null, packagingOrderId: o.id, amount: a.amount, label: `PKG-${o.orderNo}` });
      }
    }

    let payerName = "";
    if (data.partyId) {
      const [p] = await tx.select().from(schema.packagingParties).where(eq(schema.packagingParties.id, data.partyId)).limit(1);
      if (!p) throw new BizError("পার্টি পাওয়া যায়নি");
      payerName = p.name;
    } else {
      const [c] = await tx.select().from(schema.regularCustomers).where(eq(schema.regularCustomers.id, data.customerId!)).limit(1);
      if (!c) throw new BizError("কাস্টমার পাওয়া যায়নি");
      payerName = c.name;
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        amount: data.amount,
        accountId: account.id,
        partyId: data.partyId || null,
        customerId: data.customerId || null,
        source: "MANUAL",
        isAdvance: data.isAdvance,
        inCollections: data.inCollections,
        date: data.date ?? new Date(),
        notes: data.notes || null,
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();

    // One ledger row (PAYMENT_IN) — allocations reference the same payment: no double counting.
    for (const a of allocRows) {
      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        amount: a.amount,
        regularOrderId: a.regularOrderId,
        packagingOrderId: a.packagingOrderId,
      });
    }
    await tx.insert(accountTransactions).values({
      accountId: account.id,
      amount: data.amount,
      kind: "PAYMENT_IN",
      paymentId: payment.id,
      note: `${payerName} থেকে পেমেন্ট`,
      date: payment.date,
    });

    await logEvent(tx, {
      entity: "PAYMENT",
      entityId: payment.id,
      action: "CREATED",
      detail: `${payerName} → ${bnMoney(data.amount)} (${account.nameBn})${allocRows.length ? ` · বণ্টন: ${allocRows.map((x) => `${x.label} ${bnMoney(x.amount)}`).join(", ")}` : ""}`,
      actorId: actor.id,
    });
    for (const a of allocRows) {
      await logEvent(tx, {
        entity: a.regularOrderId ? "REGULAR_ORDER" : "PACKAGING_ORDER",
        entityId: (a.regularOrderId ?? a.packagingOrderId)!,
        action: "PAYMENT",
        detail: `পেমেন্ট ${bnMoney(a.amount)} (${account.nameBn}) · TXN-${payment.txnNo}`,
        actorId: actor.id,
      });
    }
    // বকেয়া শোধ হয়ে গেলে অর্ডার অটো হিস্ট্রিতে (কুরিয়ারে যাওয়া অর্ডার)
    for (const a of allocRows) {
      if (a.regularOrderId) {
        const [o] = await tx.select().from(regularOrders).where(eq(regularOrders.id, a.regularOrderId)).limit(1);
        if (o && o.status === "ACTIVE" && o.stage === "COURIER_GIVEN") {
          const [paidRow] = await tx
            .select({ paid: sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.regular_order_id = ${o.id} and p.voided_at is null), 0)` })
            .from(regularOrders)
            .where(eq(regularOrders.id, o.id));
          if (m2(o.totalAmount - (paidRow?.paid ?? 0)) <= 0) {
            await tx
              .update(regularOrders)
              .set({ stage: "COMPLETED", status: "COMPLETED", completedAt: new Date(), updatedById: actor.id })
              .where(eq(regularOrders.id, o.id));
            await logEvent(tx, { entity: "REGULAR_ORDER", entityId: o.id, action: "COMPLETED", detail: "বকেয়া শোধ — হিস্ট্রিতে গেল", actorId: actor.id });
          }
        }
      }
      if (a.packagingOrderId) {
        const [o] = await tx.select().from(packagingOrders).where(eq(packagingOrders.id, a.packagingOrderId)).limit(1);
        if (o && o.status === "ACTIVE" && o.stage === "DELIVERED") {
          const [paidRow] = await tx
            .select({ paid: sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.packaging_order_id = ${o.id} and p.voided_at is null), 0)` })
            .from(packagingOrders)
            .where(eq(packagingOrders.id, o.id));
          if (m2(o.totalBill - (paidRow?.paid ?? 0)) <= 0) {
            await tx
              .update(packagingOrders)
              .set({ stage: "COMPLETED", status: "COMPLETED", completedAt: new Date(), updatedById: actor.id })
              .where(eq(packagingOrders.id, o.id));
            await logEvent(tx, { entity: "PACKAGING_ORDER", entityId: o.id, action: "COMPLETED", detail: "বকেয়া শোধ — হিস্ট্রিতে গেল", actorId: actor.id });
          }
        }
      }
    }

    await notifyAll(tx, actor.id, {
      type: "PAYMENT_ADDED",
      message: `${actor.name}: ${payerName} থেকে ${bnMoney(data.amount)} পেমেন্ট (${account.nameBn})`,
      link: `/payments/${payment.id}`,
    });
    return payment;
  });

  return { ok: true, paymentId: payment.id, txnNo: payment.txnNo };
}

// ── Void / replace (safe edit — never breaks balances) ──────────────────────
export async function voidPayment(actor: CurrentUser, paymentId: string, reason: string) {
  if (!reason || reason.trim().length < 2) throw new BizError("কারণ লিখুন");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1).for("update");
    if (!payment) throw new BizError("পেমেন্ট পাওয়া যায়নি");
    if (payment.voidedAt) throw new BizError("এই পেমেন্ট ইতোমধ্যে বাতিল");
    await tx
      .update(payments)
      .set({ voidedAt: new Date(), voidReason: reason.trim(), updatedById: actor.id })
      .where(eq(payments.id, paymentId));
    await tx.insert(accountTransactions).values({
      accountId: payment.accountId,
      amount: m2(-payment.amount),
      kind: "PAYMENT_REVERSAL",
      paymentId: payment.id,
      note: `পেমেন্ট বাতিল — ${reason.trim()}`,
    });
    await logEvent(tx, {
      entity: "PAYMENT",
      entityId: paymentId,
      action: "VOIDED",
      detail: `${bnMoney(payment.amount)} বাতিল — ${reason.trim()}`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "PAYMENT_ADDED",
      message: `${actor.name}: TXN-${payment.txnNo} (${bnMoney(payment.amount)}) বাতিল করেছেন`,
      link: `/payments/${paymentId}`,
    });
  });
}

// ── Queries ──────────────────────────────────────────────────────────────────
export async function listPayments(opts: { q?: string; accountId?: string; from?: Date; to?: Date; partyId?: string }) {
  const db = await getDb();
  const conds = [];
  if (opts.accountId) conds.push(eq(payments.accountId, opts.accountId));
  if (opts.partyId) conds.push(eq(payments.partyId, opts.partyId));
  if (opts.from) conds.push(gte(payments.date, opts.from));
  if (opts.to) conds.push(lte(payments.date, opts.to));
  const like = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  if (like) {
    conds.push(
      or(
        sql`${payments.txnNo}::text ilike ${like}`,
        ilike(payments.notes, like),
        sql`exists (select 1 from ${schema.packagingParties} p where p.id = ${payments.partyId} and p.name ilike ${like})`,
        sql`exists (select 1 from ${schema.regularCustomers} c where c.id = ${payments.customerId} and c.name ilike ${like})`
      )!
    );
  }
  return db
    .select({
      payment: payments,
      account: accounts,
      party: schema.packagingParties,
      customer: schema.regularCustomers,
      createdByName: schema.users.name,
      allocCount: sql<number>`(select count(*)::int from ${paymentAllocations} pa where pa.payment_id = ${payments.id})`,
    })
    .from(payments)
    .innerJoin(accounts, eq(accounts.id, payments.accountId))
    .leftJoin(schema.packagingParties, eq(schema.packagingParties.id, payments.partyId))
    .leftJoin(schema.regularCustomers, eq(schema.regularCustomers.id, payments.customerId))
    .innerJoin(schema.users, eq(schema.users.id, payments.createdById))
    .where(and(...conds))
    .orderBy(desc(payments.date), desc(payments.createdAt))
    .limit(300);
}

export async function getPayment(id: string) {
  const db = await getDb();
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, id),
    with: { account: true, party: true, customer: true, createdBy: true, updatedBy: true },
  });
  if (!payment) return null;
  const allocs = await db
    .select({
      id: paymentAllocations.id,
      amount: paymentAllocations.amount,
      regularOrderId: paymentAllocations.regularOrderId,
      packagingOrderId: paymentAllocations.packagingOrderId,
      regularOrderNo: regularOrders.orderNo,
      packagingOrderNo: packagingOrders.orderNo,
      regularOrderStatus: regularOrders.status,
      packagingOrderStatus: packagingOrders.status,
    })
    .from(paymentAllocations)
    .leftJoin(regularOrders, eq(regularOrders.id, paymentAllocations.regularOrderId))
    .leftJoin(packagingOrders, eq(packagingOrders.id, paymentAllocations.packagingOrderId))
    .where(eq(paymentAllocations.paymentId, id));
  const events = await db
    .select({
      id: schema.eventLogs.id,
      action: schema.eventLogs.action,
      detail: schema.eventLogs.detail,
      createdAt: schema.eventLogs.createdAt,
      actorName: schema.users.name,
    })
    .from(schema.eventLogs)
    .leftJoin(schema.users, eq(schema.users.id, schema.eventLogs.actorId))
    .where(and(eq(schema.eventLogs.entity, "PAYMENT"), eq(schema.eventLogs.entityId, id)))
    .orderBy(desc(schema.eventLogs.createdAt))
    .limit(20);
  return { payment, allocations: allocs, events };
}

/** A party's active (non-cancelled) packaging orders with paid/due — for payment allocation UI. */
export async function getActiveOrdersForParty(partyId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: packagingOrders.id,
      orderNo: packagingOrders.orderNo,
      stage: packagingOrders.stage,
      totalBill: packagingOrders.totalBill,
      createdAt: packagingOrders.createdAt,
      paid: sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.packaging_order_id = "packaging_orders"."id" and p.voided_at is null), 0)`,
    })
    .from(packagingOrders)
    .where(and(eq(packagingOrders.partyId, partyId), eq(packagingOrders.status, "ACTIVE")))
    .orderBy(packagingOrders.createdAt);
  return rows.map((r) => ({ ...r, due: m2(r.totalBill - r.paid) }));
}

/** A regular customer's active orders with paid/due. */
export async function getActiveOrdersForCustomer(customerId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: regularOrders.id,
      orderNo: regularOrders.orderNo,
      stage: regularOrders.stage,
      totalBill: sql<number>`${regularOrders.totalAmount}`,
      createdAt: regularOrders.createdAt,
      paid: sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.regular_order_id = "regular_orders"."id" and p.voided_at is null), 0)`,
    })
    .from(regularOrders)
    .where(and(eq(regularOrders.customerId, customerId), eq(regularOrders.status, "ACTIVE")))
    .orderBy(regularOrders.createdAt);
  return rows.map((r) => ({ ...r, due: m2(r.totalBill - r.paid) }));
}

// ── Ledgers ──────────────────────────────────────────────────────────────────
export async function getPartyLedger(partyId: string) {
  const db = await getDb();
  const party = await db.query.packagingParties.findFirst({ where: eq(schema.packagingParties.id, partyId) });
  if (!party) return null;
  const orders = await getActiveOrdersForParty(partyId).then(async (active) => {
    const db2 = await getDb();
    const rest = await db2
      .select({
        id: packagingOrders.id,
        orderNo: packagingOrders.orderNo,
        stage: packagingOrders.stage,
        status: packagingOrders.status,
        totalBill: packagingOrders.totalBill,
        createdAt: packagingOrders.createdAt,
        paid: sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.packaging_order_id = "packaging_orders"."id" and p.voided_at is null), 0)`,
      })
      .from(packagingOrders)
      .where(and(eq(packagingOrders.partyId, partyId), isNull(packagingOrders.cancelledAt), eq(packagingOrders.status, "COMPLETED")))
      .orderBy(desc(packagingOrders.updatedAt))
      .limit(60);
    return [...active.map((a) => ({ ...a, status: "ACTIVE" as string })), ...rest];
  });
  const paymentRows = await db
    .select({
      id: payments.id,
      txnNo: payments.txnNo,
      amount: payments.amount,
      date: payments.date,
      voidedAt: payments.voidedAt,
      notes: payments.notes,
      accountName: accounts.nameBn,
      createdByName: schema.users.name,
    })
    .from(payments)
    .innerJoin(accounts, eq(accounts.id, payments.accountId))
    .innerJoin(schema.users, eq(schema.users.id, payments.createdById))
    .where(eq(payments.partyId, partyId))
    .orderBy(desc(payments.date))
    .limit(150);
  const totalBillPaid = m2(orders.reduce((s, o) => s + o.paid, 0));
  const totalBill = m2(orders.reduce((s, o) => s + o.totalBill, 0));
  const totalPaid = m2(paymentRows.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0));
  const cancelledBills = await db
    .select({ bill: sql<number>`coalesce(sum(${packagingOrders.totalBill})::float8,0)` })
    .from(packagingOrders)
    .where(and(eq(packagingOrders.partyId, partyId), eq(packagingOrders.status, "CANCELLED")));
  void cancelledBills;
  return { party, orders, payments: paymentRows, totalBill, totalPaid, totalDue: m2(totalBill - totalPaid), orderPaid: totalBillPaid };
}
