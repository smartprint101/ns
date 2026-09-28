import { z } from "zod";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyAll, type CurrentUser } from "./shared";
import { WORK_TYPE_BN, nextPackagingStage, packagingStageLabel } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { m2 } from "@/lib/utils";

const { packagingOrders, payments, paymentAllocations, accountTransactions, accounts } = schema;

const paidSql = sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.packaging_order_id = "packaging_orders"."id" and p.voided_at is null), 0)`;

const createSchema = z
  .object({
    partyId: z.string().optional().or(z.literal("")),
    partyName: z.string().trim().max(200).optional().or(z.literal("")),
    workType: z.enum(["CYLINDER_PACKET", "PACKET", "ART_PAPER"]),
    totalKg: z.coerce.number().positive("কেজি দিন"),
    totalBill: z.coerce.number().positive("টোটাল বিল দিন"),
    advanceAmount: z.coerce.number().min(0, "অ্যাডভান্স ঋণাত্মক হতে পারবে না").default(0),
    advanceAccountId: z.string().optional().or(z.literal("")),
    addToCollections: z.coerce.boolean().default(false),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((d) => d.partyId || d.partyName, { message: "পার্টি বেছে নিন বা নতুন নাম লিখুন" })
  .refine((d) => d.advanceAmount <= 0 || !!d.advanceAccountId, { message: "অ্যাডভান্সের টাকা কোন অ্যাকাউন্টে এলো বেছে নিন" })
  .refine((d) => d.advanceAmount <= d.totalBill, { message: "অ্যাডভান্স বিলের চেয়ে বেশি হতে পারবে না" });
export type PackagingOrderInput = z.infer<typeof createSchema>;

async function findOrCreateParty(tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0], name: string) {
  const trimmed = name.trim();
  const existing = await tx
    .select()
    .from(schema.packagingParties)
    .where(sql`lower(${schema.packagingParties.name}) = lower(${trimmed})`)
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await tx.insert(schema.packagingParties).values({ name: trimmed }).returning();
  return row;
}

export async function createPackagingOrder(actor: CurrentUser, input: unknown) {
  const data = createSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const partyId = data.partyId || (await findOrCreateParty(tx, data.partyName!)).id;
    const withAdvance = data.advanceAmount > 0;
    const [order] = await tx
      .insert(packagingOrders)
      .values({
        partyId,
        workType: data.workType,
        totalKg: data.totalKg,
        extraKg: 0,
        finalKg: data.totalKg,
        totalBill: data.totalBill,
        factoryId: null, // কারখানা পরে — «কারখানায় পাঠানো হয়েছে» ধাপে বাছাই হবে
        cylinderId: null,
        notes: data.notes || null,
        stage: "PLACED",
        status: "ACTIVE",
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();

    await logEvent(tx, {
      entity: "PACKAGING_ORDER",
      entityId: order.id,
      action: "CREATED",
      detail: `${WORK_TYPE_BN[data.workType]} · ${bn(data.totalKg)} কেজি · বিল ${bnMoney(data.totalBill)}`,
      actorId: actor.id,
    });

    if (withAdvance) {
      const [account] = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, data.advanceAccountId!), eq(accounts.active, true)))
        .limit(1);
      if (!account) throw new BizError("অ্যাডভান্সের অ্যাকাউন্ট পাওয়া যায়নি");
      const [payment] = await tx
        .insert(payments)
        .values({
          amount: data.advanceAmount,
          accountId: account.id,
          partyId,
          source: "MANUAL",
          isAdvance: true,
          inCollections: data.addToCollections,
          date: new Date(),
          notes: `অ্যাডভান্স — প্যাকেজিং অর্ডার PKG-${order.orderNo}`,
          createdById: actor.id,
          updatedById: actor.id,
        })
        .returning();
      await tx.insert(paymentAllocations).values({ paymentId: payment.id, packagingOrderId: order.id, amount: data.advanceAmount });
      await tx.insert(accountTransactions).values({
        accountId: account.id,
        amount: data.advanceAmount,
        kind: "PAYMENT_IN",
        paymentId: payment.id,
        note: `অ্যাডভান্স — PKG-${order.orderNo}`,
        date: payment.date,
      });
      await logEvent(tx, {
        entity: "PACKAGING_ORDER",
        entityId: order.id,
        action: "ADVANCE",
        detail: `অ্যাডভান্স ${bnMoney(data.advanceAmount)} (${account.nameBn})`,
        actorId: actor.id,
      });
    }

    await notifyAll(tx, actor.id, {
      type: "PACKAGING_ORDER",
      message: `${actor.name}: নতুন প্যাকেজিং অর্ডার PKG-${order.orderNo} (${WORK_TYPE_BN[data.workType]}, ${bnMoney(data.totalBill)})`,
      link: `/packaging/${order.id}`,
    });
    return order;
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────
export type PackagingTab = "active" | "completed" | "cancelled";

export async function listPackagingOrders(opts: { tab: PackagingTab; q?: string; factoryId?: string; partyId?: string }) {
  const db = await getDb();
  const like = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const statusWhere =
    opts.tab === "active"
      ? eq(packagingOrders.status, "ACTIVE")
      : opts.tab === "completed"
        ? eq(packagingOrders.status, "COMPLETED")
        : eq(packagingOrders.status, "CANCELLED");
  const conds = [statusWhere];
  if (opts.factoryId) conds.push(eq(packagingOrders.factoryId, opts.factoryId));
  if (opts.partyId) conds.push(eq(packagingOrders.partyId, opts.partyId));
  if (like) {
    conds.push(
      or(
        sql`${packagingOrders.orderNo}::text ilike ${like}`,
        sql`exists (select 1 from ${schema.packagingParties} p where p.id = ${packagingOrders.partyId} and p.name ilike ${like})`,
        ilike(packagingOrders.notes, like)
      )!
    );
  }
  const rows = await db
    .select({
      order: packagingOrders,
      party: schema.packagingParties,
      factory: schema.factories,
      cylinder: schema.cylinders,
      paid: paidSql,
    })
    .from(packagingOrders)
    .innerJoin(schema.packagingParties, eq(schema.packagingParties.id, packagingOrders.partyId))
    .leftJoin(schema.factories, eq(schema.factories.id, packagingOrders.factoryId))
    .leftJoin(schema.cylinders, eq(schema.cylinders.id, packagingOrders.cylinderId))
    .where(and(...conds))
    .orderBy(...(opts.tab === "active" ? [asc(packagingOrders.createdAt)] : [desc(packagingOrders.updatedAt)]))
    .limit(opts.tab === "active" ? 300 : 250);
  return rows;
}

// ── Detail ───────────────────────────────────────────────────────────────────
export async function getPackagingOrder(id: string) {
  const db = await getDb();
  const order = await db.query.packagingOrders.findFirst({
    where: eq(packagingOrders.id, id),
    with: { party: true, factory: true, cylinder: { with: { factory: true } }, createdBy: true, updatedBy: true, cancelledBy: true },
  });
  if (!order) return null;
  const [paidRow] = await db.select({ paid: paidSql }).from(packagingOrders).where(eq(packagingOrders.id, id));
  const [advanceRow] = await db
    .select({ advance: sql<number>`coalesce(sum(${paymentAllocations.amount})::float8, 0)` })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(and(eq(paymentAllocations.packagingOrderId, id), eq(payments.isAdvance, true), isNull(payments.voidedAt)));
  const paymentRows = await db
    .select({
      allocationId: paymentAllocations.id,
      amount: paymentAllocations.amount,
      paymentId: payments.id,
      txnNo: payments.txnNo,
      date: payments.date,
      isAdvance: payments.isAdvance,
      accountName: accounts.nameBn,
      createdByName: schema.users.name,
      voidedAt: payments.voidedAt,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .innerJoin(accounts, eq(accounts.id, payments.accountId))
    .innerJoin(schema.users, eq(schema.users.id, payments.createdById))
    .where(eq(paymentAllocations.packagingOrderId, id))
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
    .where(eq(schema.expenses.packagingOrderId, id))
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
    .where(and(eq(schema.eventLogs.entity, "PACKAGING_ORDER"), eq(schema.eventLogs.entityId, id)))
    .orderBy(desc(schema.eventLogs.createdAt))
    .limit(50);
  return { order, paid: m2(paidRow?.paid ?? 0), advance: m2(advanceRow?.advance ?? 0), payments: paymentRows, expenses: expenseRows, events };
}

// ── Workflow ─────────────────────────────────────────────────────────────────
export type AdvancePackagingOpts = {
  /** «কারখানায় পাঠানো হয়েছে» ধাপে কোন কারখানায় কাজ দিলেন। */
  factoryId?: string;
  /** «কুরিয়ারে পাঠানো হয়েছে» ধাপে পেমেন্ট — ফুল/আংশিক দিলে এখানে আসবে। */
  payment?: { amount: number; accountId: string; addToCollections?: boolean };
};

export async function advancePackagingStage(actor: CurrentUser, orderId: string, opts?: AdvancePackagingOpts) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(packagingOrders).where(eq(packagingOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("এই অর্ডার আর চলমান নেই");
    const next = nextPackagingStage(order) as (typeof schema.packagingStageEnum.enumValues)[number] | null;
    if (!next) throw new BizError("এই অর্ডার ইতোমধ্যে সম্পন্ন");

    const updating: Partial<typeof packagingOrders.$inferInsert> = {
      stage: next,
      updatedById: actor.id,
    };

    // কারখানায় পাঠানোর সময় কারখানা বাছাই বাধ্যতামূলক
    if (next === "PRODUCTION") {
      const factoryId = opts?.factoryId || order.factoryId;
      if (!factoryId) throw new BizError("কোন কারখানায় কাজ দিয়েছেন — বেছে নিন");
      const [factory] = await tx.select().from(schema.factories).where(eq(schema.factories.id, factoryId)).limit(1);
      if (!factory) throw new BizError("কারখানা পাওয়া যায়নি");
      updating.factoryId = factoryId;
    }

    // কুরিয়ারে পাঠানোর সময় পেমেন্ট (ঐচ্ছিক) — ফুল হলে সোজা হিস্ট্রিতে
    let paymentInfo = "";
    if (next === "DELIVERED" && opts?.payment && opts.payment.amount > 0) {
      const pm = opts.payment;
      const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, pm.accountId), eq(accounts.active, true))).limit(1);
      if (!account) throw new BizError("অ্যাকাউন্ট পাওয়া যায়নি");
      const [payment] = await tx
        .insert(payments)
        .values({
          amount: m2(pm.amount),
          accountId: account.id,
          partyId: order.partyId,
          source: "MANUAL",
          inCollections: !!pm.addToCollections,
          date: new Date(),
          notes: `PKG-${order.orderNo} — কুরিয়ারে পাঠানোর সময় পেমেন্ট`,
          createdById: actor.id,
          updatedById: actor.id,
        })
        .returning();
      await tx.insert(paymentAllocations).values({ paymentId: payment.id, packagingOrderId: order.id, amount: m2(pm.amount) });
      await tx.insert(accountTransactions).values({
        accountId: account.id,
        amount: m2(pm.amount),
        kind: "PAYMENT_IN",
        paymentId: payment.id,
        note: `PKG-${order.orderNo} পেমেন্ট`,
        date: payment.date,
      });
      paymentInfo = ` · পেমেন্ট ${bnMoney(pm.amount)} (${account.nameBn})`;
    }

    // কুরিয়ারে যাওয়ার পর বকেয়া না থাকলে অটো হিস্ট্রিতে
    if (next === "DELIVERED" || next === "COMPLETED") {
      const [paidRow] = await tx.select({ paid: paidSql }).from(packagingOrders).where(eq(packagingOrders.id, orderId));
      const due = m2(order.totalBill - (paidRow?.paid ?? 0));
      if (next === "COMPLETED" || due <= 0) {
        updating.stage = "COMPLETED";
        updating.status = "COMPLETED";
        updating.completedAt = new Date();
      }
    }

    await tx.update(packagingOrders).set(updating).where(eq(packagingOrders.id, orderId));
    const finalStage = updating.stage as string;
    await logEvent(tx, {
      entity: "PACKAGING_ORDER",
      entityId: orderId,
      action: "STAGE",
      detail: `${packagingStageLabel(order.workType, order.stage)} → ${packagingStageLabel(order.workType, finalStage)}${paymentInfo}`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "PACKAGING_STAGE",
      message: `${actor.name}: PKG-${order.orderNo} এখন «${packagingStageLabel(order.workType, finalStage)}» ধাপে`,
      link: `/packaging/${orderId}`,
    });
    return { stage: finalStage };
  });
}

/** পরে এক্সট্রা টাকা/বিল যোগ — টোটাল বিলের সাথে যোগ হবে। */
export async function addExtraBill(actor: CurrentUser, orderId: string, amount: number, note?: string) {
  if (!amount || amount <= 0) throw new BizError("এক্সট্রা টাকার পরিমাণ দিন");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(packagingOrders).where(eq(packagingOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("সম্পন্ন/বাতিল অর্ডারে বিল যোগ করা যাবে না");
    const newBill = m2(order.totalBill + amount);
    await tx.update(packagingOrders).set({ totalBill: newBill, updatedById: actor.id }).where(eq(packagingOrders.id, orderId));
    await logEvent(tx, {
      entity: "PACKAGING_ORDER",
      entityId: orderId,
      action: "EXTRA_BILL",
      detail: `এক্সট্রা ${bnMoney(amount)} যোগ${note ? ` — ${note}` : ""} · নতুন বিল ${bnMoney(newBill)}`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "PACKAGING_ORDER",
      message: `${actor.name}: PKG-${order.orderNo}-এ এক্সট্রা ${bnMoney(amount)} যোগ (নতুন বিল ${bnMoney(newBill)})`,
      link: `/packaging/${orderId}`,
    });
    return { totalBill: newBill };
  });
}

export async function cancelPackagingOrder(actor: CurrentUser, orderId: string, reason: string) {
  if (!reason || reason.trim().length < 2) throw new BizError("বাতিলের কারণ লিখুন");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(packagingOrders).where(eq(packagingOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("চলমান নয় — বাতিল করা যাবে না");
    await tx
      .update(packagingOrders)
      .set({ status: "CANCELLED", cancelReason: reason.trim(), cancelledAt: new Date(), cancelledById: actor.id, updatedById: actor.id })
      .where(eq(packagingOrders.id, orderId));
    await logEvent(tx, { entity: "PACKAGING_ORDER", entityId: orderId, action: "CANCELLED", detail: reason.trim(), actorId: actor.id });
    await notifyAll(tx, actor.id, {
      type: "PACKAGING_ORDER",
      message: `${actor.name}: PKG-${order.orderNo} বাতিল করেছেন`,
      link: `/packaging/${orderId}`,
    });
  });
}

const editSchema = z.object({
  totalKg: z.coerce.number().positive("কেজি দিন"),
  totalBill: z.coerce.number().positive("টোটাল বিল দিন"),
  factoryId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function updatePackagingOrder(actor: CurrentUser, orderId: string, input: unknown) {
  const data = editSchema.parse(input);
  const db = await getDb();
  const [order] = await db.select().from(packagingOrders).where(eq(packagingOrders.id, orderId)).limit(1);
  if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
  if (order.status !== "ACTIVE") throw new BizError("সম্পন্ন/বাতিল অর্ডার পরিবর্তন করা যাবে না");
  await db
    .update(packagingOrders)
    .set({
      totalKg: data.totalKg,
      finalKg: data.totalKg,
      totalBill: data.totalBill,
      factoryId: data.factoryId || order.factoryId || null,
      notes: data.notes || null,
      updatedById: actor.id,
    })
    .where(eq(packagingOrders.id, orderId));
  await logEvent(db, {
    entity: "PACKAGING_ORDER",
    entityId: orderId,
    action: "UPDATED",
    detail: `${bn(data.totalKg)} কেজি · বিল ${bnMoney(data.totalBill)}`,
    actorId: actor.id,
  });
}
