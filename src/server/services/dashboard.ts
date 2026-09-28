import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { listAccountsWithBalances } from "./accounts";
import { startOfToday, endOfToday } from "@/lib/dates";
import { m2 } from "@/lib/utils";

const { regularOrders, packagingOrders, payments, expenses, tasks, courierCollections } = schema;

export async function getDashboardData() {
  const db = await getDb();
  const from = startOfToday();
  const to = endOfToday();
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);

  const [regularByStage, todayCollection, todayExpense, expenseByCategory, pendingTasks, collectionsPending, packagingActive, packagingLong, accountsWithBalances] =
    await Promise.all([
      db
        .select({ stage: regularOrders.stage, count: sql<number>`count(*)::int` })
        .from(regularOrders)
        .where(eq(regularOrders.status, "ACTIVE"))
        .groupBy(regularOrders.stage),
      db
        .select({ sum: sql<number>`coalesce(sum(${payments.amount})::float8,0)`, count: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(sql`${payments.voidedAt} is null`, gte(payments.date, from), lt(payments.date, to))),
      db
        .select({ sum: sql<number>`coalesce(sum(${expenses.amount})::float8,0)`, count: sql<number>`count(*)::int` })
        .from(expenses)
        .where(and(sql`${expenses.voidedAt} is null`, gte(expenses.date, from), lt(expenses.date, to))),
      db
        .select({ category: expenses.category, sum: sql<number>`coalesce(sum(${expenses.amount})::float8,0)` })
        .from(expenses)
        .where(and(sql`${expenses.voidedAt} is null`, gte(expenses.date, from), lt(expenses.date, to)))
        .groupBy(expenses.category),
      db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(eq(tasks.status, "PENDING")),
      db
        .select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${courierCollections.expectedAmount})::float8,0)` })
        .from(courierCollections)
        .where(eq(courierCollections.status, "PENDING")),
      db.select({ count: sql<number>`count(*)::int` }).from(packagingOrders).where(eq(packagingOrders.status, "ACTIVE")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(packagingOrders)
        .where(and(eq(packagingOrders.status, "ACTIVE"), lt(packagingOrders.createdAt, tenDaysAgo))),
      listAccountsWithBalances(db),
    ]);

  const stageCount = Object.fromEntries(regularByStage.map((r) => [r.stage, r.count]));
  const activeRegular = regularByStage.reduce((s, r) => s + r.count, 0);

  // Oldest pending items (pending-first, oldest on top)
  const [oldestRegular, oldestPackaging, oldestTasks, recentEvents] = await Promise.all([
    db
      .select({
        id: regularOrders.id,
        orderNo: regularOrders.orderNo,
        stage: regularOrders.stage,
        totalAmount: regularOrders.totalAmount,
        createdAt: regularOrders.createdAt,
        customerName: schema.regularCustomers.name,
      })
      .from(regularOrders)
      .innerJoin(schema.regularCustomers, eq(schema.regularCustomers.id, regularOrders.customerId))
      .where(eq(regularOrders.status, "ACTIVE"))
      .orderBy(asc(regularOrders.createdAt))
      .limit(6),
    db
      .select({
        id: packagingOrders.id,
        orderNo: packagingOrders.orderNo,
        stage: packagingOrders.stage,
        workType: packagingOrders.workType,
        totalBill: packagingOrders.totalBill,
        createdAt: packagingOrders.createdAt,
        partyName: schema.packagingParties.name,
        factoryName: schema.factories.name,
      })
      .from(packagingOrders)
      .innerJoin(schema.packagingParties, eq(schema.packagingParties.id, packagingOrders.partyId))
      .innerJoin(schema.factories, eq(schema.factories.id, packagingOrders.factoryId))
      .where(eq(packagingOrders.status, "ACTIVE"))
      .orderBy(asc(packagingOrders.createdAt))
      .limit(6),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        createdAt: tasks.createdAt,
        assignedToName: schema.users.name,
      })
      .from(tasks)
      .innerJoin(schema.users, eq(schema.users.id, tasks.assignedToId))
      .where(eq(tasks.status, "PENDING"))
      .orderBy(asc(tasks.createdAt))
      .limit(6),
    db
      .select({
        id: schema.eventLogs.id,
        entity: schema.eventLogs.entity,
        entityId: schema.eventLogs.entityId,
        action: schema.eventLogs.action,
        detail: schema.eventLogs.detail,
        createdAt: schema.eventLogs.createdAt,
        actorName: schema.users.name,
      })
      .from(schema.eventLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.eventLogs.actorId))
      .orderBy(sql`${schema.eventLogs.createdAt} desc`)
      .limit(10),
  ]);

  return {
    work: {
      newOrders: stageCount["PLACED"] ?? 0,
      activeRegular,
      courierPending: stageCount["READY"] ?? 0,
      conditionPending: stageCount["CONDITION_PENDING"] ?? 0,
      packagingActive: packagingActive[0]?.count ?? 0,
      packagingLong: packagingLong[0]?.count ?? 0,
      pendingTasks: pendingTasks[0]?.count ?? 0,
      collectionsPendingCount: collectionsPending[0]?.count ?? 0,
      collectionsPendingSum: m2(collectionsPending[0]?.sum ?? 0),
    },
    money: {
      todayCollection: m2(todayCollection[0]?.sum ?? 0),
      todayCollectionCount: todayCollection[0]?.count ?? 0,
      todayExpense: m2(todayExpense[0]?.sum ?? 0),
      todayExpenseCount: todayExpense[0]?.count ?? 0,
      expenseByCategory: Object.fromEntries(expenseByCategory.map((e) => [e.category, m2(e.sum)])),
      accounts: accountsWithBalances,
    },
    lists: { oldestRegular, oldestPackaging, oldestTasks, recentEvents },
  };
}
