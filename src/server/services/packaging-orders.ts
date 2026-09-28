import { z } from "zod";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyAll, type CurrentUser } from "./shared";
import { PACKAGING_STAGE_BN, WORK_TYPE_BN, nextPackagingStage } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { m2 } from "@/lib/utils";

const { packagingOrders, payments, paymentAllocations, accountTransactions, accounts } = schema;

const paidSql = sql<number>`coalesce((select sum(pa.amount)::float8 from ${paymentAllocations} pa join ${payments} p on p.id = pa.payment_id where pa.packaging_order_id = "packaging_orders"."id" and p.voided_at is null), 0)`;

const createSchema = z
  .object({
    partyId: z.string().optional().or(z.literal("")),
    partyName: z.string().trim().max(200).optional().or(z.literal("")),
    workType: z.enum(["CYLINDER_PACKET", "PACKET", "ART_PAPER"]),
    totalKg: z.coerce.number().positive("মোট কেজি দিন"),
    extraKg: z.coerce.number().min(0, "এক্সট্রা কেজি ঋণাত্মক হতে পারবে না").default(0),
    finalKg: z.coerce.number().positive("ফাইনাল কেজি দিন").optional(),
    totalBill: z.coerce.number().positive("টোটাল বিল দিন"),
    factoryId: z.string().min(1, "ফ্যাক্টরি বেছে নিন"),
    cylinderId: z.string().optional().or(z.literal("")),
    advanceAmount: z.coerce.number().min(0, "অ্যাডভান্স ঋণাত্মক হতে পারবে না").default(0),
    advanceAccountId: z.string().optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
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
  const finalKg = data.finalKg ?? m2(data.totalKg + data.extraKg);
  if (finalKg < data.totalKg) throw new BizError("ফাইনাল কেজি মোট কেজির কম হতে পারবে না");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const partyId = data.partyId || (await findOrCreateParty(tx, data.partyName!)).id;
    const [factory] = await tx.select().from(schema.factories).where(eq(schema.factories.id, data.factoryId)).limit(1);
    if (!factory) throw new BizError("ফ্যাক্টরি পাওয়া যায়নি");
    if (data.cylinderId) {
      const [cyl] = await tx.select().from(schema.cylinders).where(eq(schema.cylinders.id, data.cylinderId)).limit(1);
      if (!cyl) throw new BizError("সিলিন্ডার পাওয়া যায়নি");
    }
    const withAdvance = data.advanceAmount > 0;
    const [order] = await tx
      .insert(packagingOrders)
      .values({
        partyId,
        workType: data.workType,
        totalKg: data.totalKg,
        extraKg: data.extraKg,
        finalKg,
        totalBill: data.totalBill,
        factoryId: data.factoryId,
        cylinderId: data.cylinderId || null,
        notes: data.notes || null,
        stage: withAdvance ? "ADVANCE" : "PLACED",
        status: "ACTIVE",
        createdById: actor.id,
        updatedById: actor.id,
      })
      .returning();

    await logEvent(tx, {
      entity: "PACKAGING_ORDER",
      entityId: order.id,
      action: "CREATED",
      detail: `${WORK_TYPE_BN[data.workType]} · ${bn(finalKg)} কেজি · বিল ${bnMoney(data.totalBill)} · ${factory.name}`,
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
    .innerJoin(schema.factories, eq(schema.factories.id, packagingOrders.factoryId))
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
export async function advancePackagingStage(actor: CurrentUser, orderId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(packagingOrders).where(eq(packagingOrders.id, orderId)).limit(1).for("update");
    if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
    if (order.status !== "ACTIVE") throw new BizError("এই অর্ডার আর চলমান নেই");
    const next = nextPackagingStage(order) as (typeof schema.packagingStageEnum.enumValues)[number] | null;
    if (!next) throw new BizError("এই অর্ডার ইতোমধ্যে সম্পন্ন");
    if (order.stage === "PLACED" && next === "ADVANCE") {
      throw new BizError("আগে অ্যাডভান্স নিন — «পেমেন্ট যোগ করুন» দিয়ে অ্যাডভান্স এন্ট্রি করুন");
    }
    const updating: Partial<typeof packagingOrders.$inferInsert> = {
      stage: next,
      updatedById: actor.id,
    };
    if (next === "COMPLETED") {
      updating.status = "COMPLETED";
      updating.completedAt = new Date();
    }
    await tx.update(packagingOrders).set(updating).where(eq(packagingOrders.id, orderId));
    await logEvent(tx, {
      entity: "PACKAGING_ORDER",
      entityId: orderId,
      action: "STAGE",
      detail: `${PACKAGING_STAGE_BN[order.stage]} → ${PACKAGING_STAGE_BN[next]}`,
      actorId: actor.id,
    });
    await notifyAll(tx, actor.id, {
      type: "PACKAGING_STAGE",
      message: `${actor.name}: PKG-${order.orderNo} এখন «${PACKAGING_STAGE_BN[next]}» ধাপে`,
      link: `/packaging/${orderId}`,
    });
    return { stage: next as string };
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
  totalKg: z.coerce.number().positive("মোট কেজি দিন"),
  extraKg: z.coerce.number().min(0).default(0),
  finalKg: z.coerce.number().positive("ফাইনাল কেজি দিন"),
  totalBill: z.coerce.number().positive("টোটাল বিল দিন"),
  factoryId: z.string().min(1, "ফ্যাক্টরি বেছে নিন"),
  cylinderId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function updatePackagingOrder(actor: CurrentUser, orderId: string, input: unknown) {
  const data = editSchema.parse(input);
  if (data.finalKg < data.totalKg) throw new BizError("ফাইনাল কেজি মোট কেজির কম হতে পারবে না");
  const db = await getDb();
  const [order] = await db.select().from(packagingOrders).where(eq(packagingOrders.id, orderId)).limit(1);
  if (!order) throw new BizError("অর্ডার পাওয়া যায়নি");
  if (order.status !== "ACTIVE") throw new BizError("সম্পন্ন/বাতিল অর্ডার পরিবর্তন করা যাবে না");
  await db
    .update(packagingOrders)
    .set({
      totalKg: data.totalKg,
      extraKg: data.extraKg,
      finalKg: data.finalKg,
      totalBill: data.totalBill,
      factoryId: data.factoryId,
      cylinderId: data.cylinderId || null,
      notes: data.notes || null,
      updatedById: actor.id,
    })
    .where(eq(packagingOrders.id, orderId));
  await logEvent(db, {
    entity: "PACKAGING_ORDER",
    entityId: orderId,
    action: "UPDATED",
    detail: `${bn(data.finalKg)} কেজি · বিল ${bnMoney(data.totalBill)}`,
    actorId: actor.id,
  });
}
