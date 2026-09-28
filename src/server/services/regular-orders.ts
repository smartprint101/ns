import { z } from "zod";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyAll, type CurrentUser } from "./shared";
import { findOrCreateCustomer } from "./masters";
import { REGULAR_STAGE_BN } from "@/lib/labels";
import { bnMoney } from "@/lib/bn";
import { m2 } from "@/lib/utils";

const { regularOrders, payments, paymentAllocations, accountTransactions, accounts } = schema;

const paidSql = sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.regular_order_id = "regular_orders"."id" and p.voided_at is null), 0)`;

// ── Create ───────────────────────────────────────────────────────────────────
const createSchema = z
  .object({
    customerId: z.string().optional().or(z.literal("")),
    customerName: z.string().trim().max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    customerAddress: z.string().trim().max(500).optional().or(z.literal("")),
    productName: z.string().trim().min(1, "পণ্যের নাম দিন"),
    quantity: z.coerce.number().positive("পরিমাণ ০-এর বেশি হতে হবে"),
    price: z.coerce.number().min(0, "দাম ঋণাত্মক হতে পারবে না"),
    deliveryCharge: z.coerce.number().min(0, "ডেলিভারি চার্জ ঋণাত্মক হতে পারবে না").default(0),
    hasCondition: z.coerce.boolean().default(false),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.customerId || d.customerName, { message: "কাস্টমার বেছে নিন বা নতুন নাম লিখুন" });
export type RegularOrderInput = z.infer<typeof createSchema>;

export async function createRegularOrder(actor: CurrentUser, input: unknown) {
  const data = createSchema.parse(input);
  const totalAmount = m2(m2(data.quantity * data.price) + data.deliveryCharge);
  if (totalAmount <= 0) throw new BizError("মোট টাকা ০ হতে পারবে না");
  const db = await getDb();
  return db.transaction(async (tx) => {
    let customerId = data.customerId || "";
    if (!customerId) {
      const c = await findOrCreateCustomer(tx, data.customerName!, data.phone, data.customerAddress);
      customerId = c.id;
    } else {
      const [c] = await tx.select().from(schema.regularCustomers).where(eq(schema.regularCustomers.id, customerId)).limit(1);
      if (!c) throw new BizError("কাস্টমার পাওয়া যায়নি");
    }
    const [order] = await tx
      .insert(regularOrders)
      .values({
        customerId,
        productName: data.productName,
        quantity: data.quantity,
        price: data.price,
        deliveryCharge: data.deliveryCharge,
        totalAmount,
        address: data.address || null,
        notes: data.notes || null,
        hasCondition: data.hasCondition,
        stage: "PLACED",
        status: "ACTIVE",
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();
    await logEvent(tx, {
      entity: "REGULAR_ORDER",
      entityId: order.id,
      action: "CREATED",
      detail: `${data.productName} — ${bnMoney(totalAmount)}${data.hasCondition ? " · কন্ডিশন আছে" : ""}`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "REGULAR_ORDER",
      message: `${actor.name}: নতুন রেগুলার অর্ডার #${order.orderNo} (${bnMoney(totalAmount)})`,
      link: `/orders/${order.id}`,
    });
    return order;
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────
export type RegularTab = "active" | "completed" | "cancelled";

export async function listRegularOrders(opts: { tab: RegularTab; q?: string }) {
  const db = await getDb();
  const like = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const baseWhere =
    opts.tab === "active"
      ? eq(regularOrders.status, "ACTIVE")
      : opts.tab === "completed"
        ? eq(regularOrders.status, "COMPLETED")
        : eq(regularOrders.status, "CANCELLED");
  const searchWhere = like
    ? or(
        ilike(regularOrders.productName, like),
        sql`${regularOrders.orderNo}::text ilike ${like}`,
        sql`exists (select 1 from ${schema.regularCustomers} c where c.id = ${regularOrders.customerId} and (c.name ilike ${like} or c.phone ilike ${like}))`
      )
    : undefined;
  const order =
    opts.tab === "active" ? [asc(regularOrders.createdAt)] : [desc(regularOrders.updatedAt)];
  return db
    .select({ order: regularOrders, customer: schema.regularCustomers, paid: paidSql })
    .from(regularOrders)
    .innerJoin(schema.regularCustomers, eq(schema.regularCustomers.id, regularOrders.customerId))
    .where(and(baseWhere, ...(searchWhere ? [searchWhere] : [])))
    .orderBy(...order)
    .limit(opts.tab === "active" ? 300 : 200);
}

// ── Detail ───────────────────────────────────────────────────────────────────
export async function getRegularOrder(id: string) {
  const db = await getDb();
  const order = await db.query.regularOrders.findFirst({
    where: eq(regularOrders.id, id),
    with: { customer: true, createdBy: true, updatedBy: true, cancelledBy: true, conditionReceivedBy: true },
  });
  if (!order) return null;
  const [paidRow] = await db.select({ paid: paidSql }).from(regularOrders).where(eq(regularOrders.id, id));
  const paymentRows = await db
    .select({
      allocationId: paymentAllocations.id,
      amount: paymentAllocations.amount,
      paymentId: payments.id,
      txnNo: payments.txnNo,
      date: payments.date,
      accountName: accounts.nameBn,
      createdByName: schema.users.name,
      source: payments.source,
      voidedAt: payments.voidedAt,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .innerJoin(accounts, eq(accounts.id, payments.accountId))
    .innerJoin(schema.users, eq(schema.users.id, payments.createdById))
    .where(eq(paymentAllocations.regularOrderId, id))
    .orderBy(desc(payments.date));
  const expenseRows = await db
    .select({
      id: schema.expenses.id,
      amount: schema.expenses.amount,
      category: schema.expenses.category,
      description: schema.expenses.description,
      date: schema.expenses.date,
      voidedAt: schema.expenses.voidedAt,
      createdByName: schema.users.name,
    })
    .from(schema.expenses)
    .innerJoin(schema.users, eq(schema.users.id, schema.expenses.createdById))
    .where(eq(schema.expenses.regularOrderId, id))
    .orderBy(desc(schema.expenses.date));
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
    .where(and(eq(schema.eventLogs.entity, "REGULAR_ORDER"), eq(schema.eventLogs.entityId, id)))
    .orderBy(desc(schema.eventLogs.createdAt))
    .limit(40);
  return { order, paid: m2(paidRow?.paid ?? 0), payments: paymentRows, expenses: expenseRows, events };
}

// ── Workflow ─────────────────────────────────────────────────────────────────
export async function advanceRegularStage(actor: CurrentUser, orderId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(regularOrders).where(eq(regularOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("এই অর্ডার আর চলমান নেই");

    let next: "READY" | "CONDITION_PENDING" | "COMPLETED";
    if (order.stage === "PLACED") next = "READY";
    else if (order.stage === "READY") next = order.hasCondition ? "CONDITION_PENDING" : "COMPLETED";
    else if (order.stage === "CONDITION_PENDING") throw new BizError("কন্ডিশন পেন্ডিং — টাকা এলে «কন্ডিশন রিসিভ» করুন");
    else throw new BizError("এই অর্ডার ইতোমধ্যে সম্পন্ন");

    const updating: Partial<typeof regularOrders.$inferInsert> = { stage: next, updatedById: actor.id };
    if (order.stage === "READY") updating.courierGivenAt = new Date();
    if (next === "COMPLETED") {
      updating.status = "COMPLETED";
      updating.completedAt = new Date();
    }
    await tx.update(regularOrders).set(updating).where(eq(regularOrders.id, orderId));
    const via = order.stage === "READY" ? "কুরিয়ার দেওয়া হলো → " : "";
    await logEvent(tx, {
      entity: "REGULAR_ORDER",
      entityId: orderId,
      action: "STAGE",
      detail: `${REGULAR_STAGE_BN[order.stage]} → ${via}${REGULAR_STAGE_BN[next]}`,
      actorId: actor.id,
    });
    const msg =
      next === "READY"
        ? `অর্ডার #${order.orderNo}: প্রোডাক্ট রেডি`
        : next === "CONDITION_PENDING"
          ? `অর্ডার #${order.orderNo}: কুরিয়ার দেওয়া হয়েছে — কন্ডিশন পেন্ডিং`
          : `অর্ডার #${order.orderNo}: কুরিয়ার দেওয়া হয়েছে — সম্পন্ন`;
    await notifyAll(tx, actor.id, { type: "REGULAR_ORDER", message: `${actor.name}: ${msg}`, link: `/orders/${orderId}` });
    return { stage: next };
  });
}

export async function cancelRegularOrder(actor: CurrentUser, orderId: string, reason: string) {
  if (!reason || reason.trim().length < 2) throw new BizError("বাতিলের কারণ লিখুন");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(regularOrders).where(eq(regularOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("চলমান নয় — বাতিল করা যাবে না");
    await tx
      .update(regularOrders)
      .set({ status: "CANCELLED", cancelReason: reason.trim(), cancelledAt: new Date(), cancelledById: actor.id, updatedById: actor.id })
      .where(eq(regularOrders.id, orderId));
    await logEvent(tx, { entity: "REGULAR_ORDER", entityId: orderId, action: "CANCELLED", detail: reason.trim(), actorId: actor.id });
    await notifyAll(tx, actor.id, {
      type: "REGULAR_ORDER",
      message: `${actor.name}: অর্ডার #${order.orderNo} বাতিল করেছেন`,
      link: `/orders/${orderId}`,
    });
  });
}

const updateSchema = createSchema.innerType().omit({ customerId: true, customerName: true, phone: true, customerAddress: true });
export async function updateRegularOrder(actor: CurrentUser, orderId: string, input: unknown) {
  const data = updateSchema.parse(input);
  const totalAmount = m2(m2(data.quantity * data.price) + data.deliveryCharge);
  if (totalAmount <= 0) throw new BizError("মোট টাকা ০ হতে পারবে না");
  const db = await getDb();
  const [order] = await db.select().from(regularOrders).where(eq(regularOrders.id, orderId)).limit(1);
  if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
  if (order.status !== "ACTIVE") throw new BizError("সম্পন্ন/বাতিল অর্ডার পরিবর্তন করা যাবে না");
  await db
    .update(regularOrders)
    .set({
      productName: data.productName,
      quantity: data.quantity,
      price: data.price,
      deliveryCharge: data.deliveryCharge,
      totalAmount,
      address: data.address || null,
      notes: data.notes || null,
      hasCondition: data.hasCondition,
      updatedById: actor.id,
    })
    .where(eq(regularOrders.id, orderId));
  await logEvent(db, { entity: "REGULAR_ORDER", entityId: orderId, action: "UPDATED", detail: `মোট ${bnMoney(totalAmount)}`, actorId: actor.id });
}

// ── Condition (কন্ডিশন) ─────────────────────────────────────────────────────
/** Pending conditions closest to the received amount (oldest first within matches). */
export async function findConditionMatches(amount: number) {
  const db = await getDb();
  const rows = await db
    .select({ order: regularOrders, customer: schema.regularCustomers })
    .from(regularOrders)
    .innerJoin(schema.regularCustomers, eq(schema.regularCustomers.id, regularOrders.customerId))
    .where(and(eq(regularOrders.status, "ACTIVE"), eq(regularOrders.stage, "CONDITION_PENDING")))
    .orderBy(asc(regularOrders.createdAt));
  const tolerance = Math.max(500, amount * 0.15);
  return rows
    .map((r) => ({ ...r, diff: Math.abs(r.order.totalAmount - amount) }))
    .filter((r) => r.diff <= tolerance)
    .sort((a, b) => a.diff - b.diff || a.order.createdAt.getTime() - b.order.createdAt.getTime())
    .slice(0, 8);
}

export async function listPendingConditions() {
  const db = await getDb();
  return db
    .select({ order: regularOrders, customer: schema.regularCustomers })
    .from(regularOrders)
    .innerJoin(schema.regularCustomers, eq(schema.regularCustomers.id, regularOrders.customerId))
    .where(and(eq(regularOrders.status, "ACTIVE"), eq(regularOrders.stage, "CONDITION_PENDING")))
    .orderBy(asc(regularOrders.createdAt)); // oldest first
}

const conditionSchema = z.object({
  orderId: z.string().min(1),
  receivedAmount: z.coerce.number().positive("কন্ডিশনের টাকার পরিমাণ দিন"),
  accountId: z.string().min(1, "টাকা কোথায় জমা হলো বেছে নিন"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function receiveCondition(actor: CurrentUser, input: unknown) {
  const data = conditionSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(regularOrders).where(eq(regularOrders.id, data.orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE" || order.stage !== "CONDITION_PENDING")
      throw new BizError("এই অর্ডারে কন্ডিশন পেন্ডিং নেই");
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, data.accountId), eq(accounts.active, true))).limit(1);
    if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");

    await tx
      .update(regularOrders)
      .set({
        conditionAmount: data.receivedAmount,
        conditionReceivedAt: new Date(),
        conditionReceivedById: actor.id,
        stage: "COMPLETED",
        status: "COMPLETED",
        completedAt: new Date(),
        updatedById: actor.id,
      })
      .where(eq(regularOrders.id, data.orderId));

    const [payment] = await tx
      .insert(payments)
      .values({
        amount: data.receivedAmount,
        accountId: account.id,
        customerId: order.customerId,
        source: "CONDITION",
        date: new Date(),
        notes: `কন্ডিশন — রেগুলার অর্ডার #${order.orderNo}${data.notes ? ` · ${data.notes}` : ""}`,
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();
    await tx
      .insert(paymentAllocations)
      .values({ paymentId: payment.id, regularOrderId: order.id, amount: data.receivedAmount });
    await tx.insert(accountTransactions).values({
      accountId: account.id,
      amount: data.receivedAmount,
      kind: "PAYMENT_IN",
      paymentId: payment.id,
      note: `কন্ডিশন — অর্ডার #${order.orderNo}`,
      date: payment.date,
    });
    await logEvent(tx, {
      entity: "REGULAR_ORDER",
      entityId: order.id,
      action: "CONDITION_RECEIVED",
      detail: `${bnMoney(data.receivedAmount)} রিসিভ (${account.nameBn}) · অর্ডার সম্পন্ন`,
      actorId: actor.id,
    });
    await logEvent(tx, {
      entity: "PAYMENT",
      entityId: payment.id,
      action: "CREATED",
      detail: `কন্ডিশন — অর্ডার #${order.orderNo} · ${bnMoney(data.receivedAmount)} (${account.nameBn})`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "CONDITION_RECEIVED",
      message: `${actor.name}: অর্ডার #${order.orderNo}-এর কন্ডিশন ${bnMoney(data.receivedAmount)} রিসিভ করেছেন`,
      link: `/orders/${order.id}`,
    });
    return { paymentId: payment.id };
  });
}
