import { z } from "zod";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyAll, type CurrentUser } from "./shared";
import { findOrCreateCustomer } from "./masters";
import { createBookEntryTask } from "./tasks";
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
    totalAmount: z.coerce.number().positive("মোট টাকার পরিমাণ দিন"),
    paidAmount: z.coerce.number().min(0, "কালেকশন ঋণাত্মক হতে পারবে না").default(0),
    paidAccountId: z.string().optional().or(z.literal("")),
    addToCollections: z.coerce.boolean().default(true),
    hasCondition: z.coerce.boolean().default(false),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((d) => d.customerId || d.customerName, { message: "কাস্টমার বেছে নিন বা নতুন নাম লিখুন" })
  .refine((d) => d.paidAmount <= 0 || !!d.paidAccountId, { message: "কালেকশনের টাকা কোন অ্যাকাউন্টে এলো বেছে নিন" })
  .refine((d) => d.paidAmount <= d.totalAmount, { message: "কালেকশন মোট টাকার চেয়ে বেশি হতে পারবে না" });
export type RegularOrderInput = z.infer<typeof createSchema>;

export async function createRegularOrder(actor: CurrentUser, input: unknown) {
  const data = createSchema.parse(input);
  const totalAmount = m2(data.totalAmount);
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
        productName: null,
        quantity: null,
        price: null,
        deliveryCharge: 0,
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
      detail: `মোট ${bnMoney(totalAmount)}${data.paidAmount > 0 ? ` · কালেকশন ${bnMoney(data.paidAmount)}` : ""}${data.hasCondition ? " · কন্ডিশন আছে" : ""}`,
      actorId: actor.id,
    });

    // এন্ট্রির সাথে কালেকশন (জমা) থাকলে — কালেকশন এন্ট্রি + অ্যাকাউন্টে টাকা
    if (data.paidAmount > 0) {
      const [account] = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, data.paidAccountId!), eq(accounts.active, true)))
        .limit(1);
      if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");
      const [payment] = await tx
        .insert(payments)
        .values({
          amount: data.paidAmount,
          accountId: account.id,
          customerId,
          source: "MANUAL",
          isAdvance: true,
          inCollections: true,
          date: new Date(),
          notes: `অর্ডার #${order.orderNo}-এর কালেকশন`,
          createdById: actor.id,
          updatedById: actor.id,
        })
        .returning();
      await tx.insert(paymentAllocations).values({ paymentId: payment.id, regularOrderId: order.id, amount: data.paidAmount });
      await tx.insert(accountTransactions).values({
        accountId: account.id,
        amount: data.paidAmount,
        kind: "PAYMENT_IN",
        paymentId: payment.id,
        note: `অর্ডার #${order.orderNo}-এর কালেকশন`,
        date: payment.date,
      });
      await logEvent(tx, {
        entity: "REGULAR_ORDER",
        entityId: order.id,
        action: "PAYMENT",
        detail: `কালেকশন ${bnMoney(data.paidAmount)} (${account.nameBn})`,
        actorId: actor.id,
      });
      await createBookEntryTask(tx, actor, {
        title: `কালেকশন ${bnMoney(data.paidAmount)} — অর্ডার #${order.orderNo}`,
        description: `টাকা এসেছে: ${account.nameBn}`,
        linkEntity: "PAYMENT",
        linkEntityId: payment.id,
      });
    }

    // অটো টাস্ক: "নতুন অর্ডারের স্লিপ করো" — কেউ শেষ করলে ধাপ এগোবে
    const [customerRow] = await tx.select().from(schema.regularCustomers).where(eq(schema.regularCustomers.id, customerId)).limit(1);
    await tx.insert(schema.tasks).values({
      title: `নতুন অর্ডারের স্লিপ করো — অর্ডার #${order.orderNo} (${customerRow?.name ?? ""})`,
      description: `মোট ${bnMoney(totalAmount)}${data.notes ? ` · ${data.notes}` : ""}`,
      assignedToId: actor.id,
      createdById: actor.id,
      regularOrderId: order.id,
    });

    await notifyAll(tx, actor.id, {
      type: "REGULAR_ORDER",
      message: `${actor.name}: নতুন রেগুলার অর্ডার #${order.orderNo} (${bnMoney(totalAmount)}) — স্লিপ করতে হবে`,
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
/**
 * ধাপ এগোনো: খাতায় লেখা → স্লিপ তৈরি → কুরিয়ারে পাঠানো।
 * কুরিয়ারের পর: কন্ডিশন থাকলে «কুরিয়ার কন্ডিশন বকেয়া», বকেয়া থাকলে «বকেয়া» (বকেয়া পেজে),
 * আর পুরো টাকা জমা থাকলে সোজা হিস্ট্রিতে।
 */
export async function advanceRegularStage(actor: CurrentUser, orderId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(regularOrders).where(eq(regularOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("এই অর্ডার আর চলমান নেই");

    let next: "READY" | "COURIER_GIVEN" | "CONDITION_PENDING" | "COMPLETED";
    if (order.stage === "PLACED") next = "READY";
    else if (order.stage === "READY") {
      if (order.hasCondition) next = "CONDITION_PENDING";
      else {
        const [paidRow] = await tx.select({ paid: paidSql }).from(regularOrders).where(eq(regularOrders.id, orderId));
        const due = m2(order.totalAmount - (paidRow?.paid ?? 0));
        next = due <= 0 ? "COMPLETED" : "COURIER_GIVEN";
      }
    } else if (order.stage === "CONDITION_PENDING") throw new BizError("কুরিয়ার কন্ডিশন বকেয়া — টাকা এলে «কন্ডিশন রিসিভ» করুন");
    else if (order.stage === "COURIER_GIVEN") throw new BizError("বকেয়া আছে — টাকা পেলে কালেকশন এন্ট্রি করুন, পুরো টাকা পেলে অর্ডার নিজে হিস্ট্রিতে যাবে");
    else throw new BizError("এই অর্ডার ইতোমধ্যে সম্পন্ন");

    const updating: Partial<typeof regularOrders.$inferInsert> = { stage: next, updatedById: actor.id };
    if (order.stage === "READY") updating.courierGivenAt = new Date();
    if (next === "COMPLETED") {
      updating.status = "COMPLETED";
      updating.completedAt = new Date();
    }
    await tx.update(regularOrders).set(updating).where(eq(regularOrders.id, orderId));
    await logEvent(tx, {
      entity: "REGULAR_ORDER",
      entityId: orderId,
      action: "STAGE",
      detail: `${REGULAR_STAGE_BN[order.stage]} → ${next === "COMPLETED" ? "কুরিয়ারে পাঠানো হয়েছে · সম্পন্ন" : REGULAR_STAGE_BN[next]}`,
      actorId: actor.id,
    });
    const msg =
      next === "READY"
        ? `অর্ডার #${order.orderNo}: স্লিপ তৈরি করা হয়েছে`
        : next === "CONDITION_PENDING"
          ? `অর্ডার #${order.orderNo}: কুরিয়ারে পাঠানো হয়েছে — কুরিয়ার কন্ডিশন বকেয়া`
          : next === "COURIER_GIVEN"
            ? `অর্ডার #${order.orderNo}: কুরিয়ারে পাঠানো হয়েছে — বকেয়া আছে`
            : `অর্ডার #${order.orderNo}: কুরিয়ারে পাঠানো হয়েছে — সম্পন্ন`;
    await notifyAll(tx, actor.id, { type: "REGULAR_ORDER", message: `${actor.name}: ${msg}`, link: `/orders/${orderId}` });
    return { stage: next };
  });
}

/** টাস্ক থেকে স্লিপ সম্পন্ন হলে — শুধু «খাতায় লেখা» ধাপ হলে এগোয়। */
export async function markSlipDoneFromTask(tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0], actor: CurrentUser, orderId: string) {
  const [order] = await tx.select().from(regularOrders).where(eq(regularOrders.id, orderId)).limit(1).for("update");
  if (!order || order.status !== "ACTIVE" || order.stage !== "PLACED") return;
  await tx.update(regularOrders).set({ stage: "READY", updatedById: actor.id }).where(eq(regularOrders.id, orderId));
  await logEvent(tx, {
    entity: "REGULAR_ORDER",
    entityId: orderId,
    action: "STAGE",
    detail: `${REGULAR_STAGE_BN.PLACED} → ${REGULAR_STAGE_BN.READY} (টাস্ক থেকে)`,
    actorId: actor.id,
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

const updateSchema = z.object({
  totalAmount: z.coerce.number().positive("মোট টাকার পরিমাণ দিন"),
  hasCondition: z.coerce.boolean().default(false),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export async function updateRegularOrder(actor: CurrentUser, orderId: string, input: unknown) {
  const data = updateSchema.parse(input);
  const totalAmount = m2(data.totalAmount);
  if (totalAmount <= 0) throw new BizError("মোট টাকা ০ হতে পারবে না");
  const db = await getDb();
  const [order] = await db.select().from(regularOrders).where(eq(regularOrders.id, orderId)).limit(1);
  if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
  if (order.status !== "ACTIVE") throw new BizError("সম্পন্ন/বাতিল অর্ডার পরিবর্তন করা যাবে না");
  await db
    .update(regularOrders)
    .set({
      totalAmount,
      address: data.address || null,
      notes: data.notes || null,
      hasCondition: data.hasCondition,
      updatedById: actor.id,
    })
    .where(eq(regularOrders.id, orderId));
  await logEvent(db, { entity: "REGULAR_ORDER", entityId: orderId, action: "UPDATED", detail: `মোট ${bnMoney(totalAmount)}`, actorId: actor.id });
}

// ── বকেয়া (কাস্টমারের বকেয়া পেজ) ────────────────────────────────────────────
/**
 * কুরিয়ারে যাওয়ার পর যাদের টাকা বাকি: কন্ডিশন বকেয়া বা সাধারণ বকেয়া।
 * কাস্টমার ধরে গ্রুপ — যার বকেয়া যত পুরোনো সে তত উপরে। «নিচে পাঠানো» কাস্টমাররা সবার শেষে।
 */
export async function listCustomerDues() {
  const db = await getDb();
  const rows = await db
    .select({ order: regularOrders, customer: schema.regularCustomers, paid: paidSql })
    .from(regularOrders)
    .innerJoin(schema.regularCustomers, eq(schema.regularCustomers.id, regularOrders.customerId))
    .where(
      and(
        eq(regularOrders.status, "ACTIVE"),
        or(eq(regularOrders.stage, "CONDITION_PENDING"), eq(regularOrders.stage, "COURIER_GIVEN"))
      )
    )
    .orderBy(asc(regularOrders.createdAt));

  type DueOrder = {
    id: string;
    orderNo: number;
    stage: string;
    totalAmount: number;
    paid: number;
    due: number;
    courierGivenAt: Date | null;
    createdAt: Date;
    notes: string | null;
  };
  const byCustomer = new Map<
    string,
    { customer: { id: string; name: string; phone: string | null; duesDemotedAt: Date | null }; orders: DueOrder[]; totalDue: number; oldest: Date }
  >();
  for (const r of rows) {
    const due = m2(r.order.totalAmount - r.paid);
    if (r.order.stage === "COURIER_GIVEN" && due <= 0) continue;
    const dueAmount = r.order.stage === "CONDITION_PENDING" ? Math.max(due, 0) : due;
    const since = r.order.courierGivenAt ?? r.order.createdAt;
    const entry = byCustomer.get(r.customer.id) ?? {
      customer: { id: r.customer.id, name: r.customer.name, phone: r.customer.phone, duesDemotedAt: r.customer.duesDemotedAt },
      orders: [],
      totalDue: 0,
      oldest: since,
    };
    entry.orders.push({
      id: r.order.id,
      orderNo: r.order.orderNo,
      stage: r.order.stage,
      totalAmount: r.order.totalAmount,
      paid: m2(r.paid),
      due: dueAmount,
      courierGivenAt: r.order.courierGivenAt,
      createdAt: r.order.createdAt,
      notes: r.order.notes,
    });
    entry.totalDue = m2(entry.totalDue + dueAmount);
    if (since < entry.oldest) entry.oldest = since;
    byCustomer.set(r.customer.id, entry);
  }
  const list = [...byCustomer.values()];
  list.sort((a, b) => {
    const ad = a.customer.duesDemotedAt ? 1 : 0;
    const bd = b.customer.duesDemotedAt ? 1 : 0;
    if (ad !== bd) return ad - bd; // demoted last
    if (ad === 1) return (a.customer.duesDemotedAt!.getTime() - b.customer.duesDemotedAt!.getTime());
    return a.oldest.getTime() - b.oldest.getTime(); // oldest due first
  });
  return list;
}

/** বকেয়া লিস্টে কাস্টমারকে নিচে পাঠানো / আবার উপরে আনা। */
export async function setCustomerDuesDemoted(actor: CurrentUser, customerId: string, demoted: boolean) {
  const db = await getDb();
  const [c] = await db.select().from(schema.regularCustomers).where(eq(schema.regularCustomers.id, customerId)).limit(1);
  if (!c) throw new BizError("কাস্টমার পাওয়া যায়নি");
  await db
    .update(schema.regularCustomers)
    .set({ duesDemotedAt: demoted ? new Date() : null })
    .where(eq(schema.regularCustomers.id, customerId));
  await logEvent(db, {
    entity: "CUSTOMER",
    entityId: customerId,
    action: demoted ? "DUES_DEMOTED" : "DUES_RESTORED",
    detail: demoted ? `${c.name} — বকেয়া লিস্টের নিচে পাঠানো হয়েছে` : `${c.name} — বকেয়া লিস্টে আবার উপরে`,
    actorId: actor.id,
  });
}

// ── Condition// ── Condition (কন্ডিশন) ─────────────────────────────────────────────────────
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
        inCollections: true,
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
    await createBookEntryTask(tx, actor, {
      title: `কন্ডিশন কালেকশন ${bnMoney(data.receivedAmount)} — অর্ডার #${order.orderNo}`,
      description: `${account.nameBn}${data.notes ? ` · ${data.notes}` : ""}`,
      linkEntity: "PAYMENT",
      linkEntityId: payment.id,
    });
    await notifyAll(tx, actor.id, {
      type: "CONDITION_RECEIVED",
      message: `${actor.name}: অর্ডার #${order.orderNo}-এর কন্ডিশন ${bnMoney(data.receivedAmount)} রিসিভ করেছেন`,
      link: `/orders/${order.id}`,
    });
    return { paymentId: payment.id };
  });
}
