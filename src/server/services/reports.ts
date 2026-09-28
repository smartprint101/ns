import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { startOfMonth } from "@/lib/dates";
import { m2 } from "@/lib/utils";
import { bn } from "@/lib/bn";

const { payments, expenses, packagingOrders, regularOrders, packagingParties, factories, accounts, tasks, users } = schema;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const bnMonths = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
export function dayLabel(key: string) {
  const [, m, d] = key.split("-").map(Number);
  return `${bn(d)} ${bnMonths[m - 1]}`;
}
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${bnMonths[m - 1]} ${bn(y)}`;
}

export async function getReport(fromDate?: Date, toDate?: Date) {
  const db = await getDb();
  const from = fromDate ?? startOfMonth();
  const to = toDate ?? new Date();

  const [paymentRows, expenseRows] = await Promise.all([
    db
      .select({ amount: payments.amount, date: payments.date, accountName: accounts.nameBn })
      .from(payments)
      .innerJoin(accounts, eq(accounts.id, payments.accountId))
      .where(and(isNull(payments.voidedAt), gte(payments.date, from), lte(payments.date, to)))
      .orderBy(payments.date),
    db
      .select({ amount: expenses.amount, date: expenses.date, category: expenses.category, accountName: accounts.nameBn })
      .from(expenses)
      .innerJoin(accounts, eq(accounts.id, expenses.accountId))
      .where(and(isNull(expenses.voidedAt), gte(expenses.date, from), lte(expenses.date, to)))
      .orderBy(expenses.date),
  ]);

  // Daily + monthly aggregation (JS-side: ranges are bounded, fully portable)
  const daily = new Map<string, { collection: number; expense: number }>();
  const monthly = new Map<string, { collection: number; expense: number }>();
  const addTo = (map: Map<string, { collection: number; expense: number }>, key: string, field: "collection" | "expense", amt: number) => {
    const row = map.get(key) ?? { collection: 0, expense: 0 };
    row[field] = m2(row[field] + amt);
    map.set(key, row);
  };
  for (const p of paymentRows) {
    addTo(daily, dayKey(p.date), "collection", p.amount);
    addTo(monthly, monthKey(p.date), "collection", p.amount);
  }
  for (const e of expenseRows) {
    addTo(daily, dayKey(e.date), "expense", e.amount);
    addTo(monthly, monthKey(e.date), "expense", e.amount);
  }
  const byCategory = new Map<string, number>();
  for (const e of expenseRows) byCategory.set(e.category, m2((byCategory.get(e.category) ?? 0) + e.amount));

  // Party dues
  const partyRows = await db
    .select({
      id: packagingParties.id,
      name: packagingParties.name,
      bill: sql<number>`coalesce((select sum(o.total_bill)::float8 from ${packagingOrders} o where o.party_id = "packaging_parties"."id" and o.status != 'CANCELLED'), 0)`,
      paid: sql<number>`coalesce((select sum(p.amount)::float8 from ${payments} p where p.party_id = "packaging_parties"."id" and p.voided_at is null), 0)`,
    })
    .from(packagingParties)
    .orderBy(packagingParties.name);
  const customerRows = await db
    .select({
      id: schema.regularCustomers.id,
      name: schema.regularCustomers.name,
      phone: schema.regularCustomers.phone,
      bill: sql<number>`coalesce((select sum(o.total_amount)::float8 from ${regularOrders} o where o.customer_id = "regular_customers"."id" and o.status != 'CANCELLED'), 0)`,
      paid: sql<number>`coalesce((select sum(p.amount)::float8 from ${payments} p where p.customer_id = "regular_customers"."id" and p.voided_at is null), 0)`,
    })
    .from(schema.regularCustomers)
    .orderBy(schema.regularCustomers.name);

  // Factory ledger (payments made via expenses linked to factory)
  const factoryRows = await db
    .select({
      id: factories.id,
      name: factories.name,
      openingDue: factories.openingDue,
      paid: sql<number>`coalesce((select sum(e.amount)::float8 from ${expenses} e where e.factory_id = "factories"."id" and e.voided_at is null), 0)`,
      workCount: sql<number>`(select count(*)::int from ${packagingOrders} o where o.factory_id = ${factories.id} and o.status = 'ACTIVE')`,
    })
    .from(factories)
    .orderBy(factories.name);

  // Order + task counts
  const [roCounts] = await db
    .select({
      active: sql<number>`count(*) filter (where status = 'ACTIVE')::int`,
      completed: sql<number>`count(*) filter (where status = 'COMPLETED')::int`,
      cancelled: sql<number>`count(*) filter (where status = 'CANCELLED')::int`,
    })
    .from(regularOrders);
  const [poCounts] = await db
    .select({
      active: sql<number>`count(*) filter (where status = 'ACTIVE')::int`,
      completed: sql<number>`count(*) filter (where status = 'COMPLETED')::int`,
      cancelled: sql<number>`count(*) filter (where status = 'CANCELLED')::int`,
    })
    .from(packagingOrders);

  const taskRows = await db
    .select({
      userId: tasks.assignedToId,
      userName: users.name,
      pending: sql<number>`count(*) filter (where ${tasks.status} = 'PENDING')::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'COMPLETED')::int`,
      cancelled: sql<number>`count(*) filter (where ${tasks.status} = 'CANCELLED')::int`,
    })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.assignedToId))
    .groupBy(tasks.assignedToId, users.name)
    .orderBy(users.name);

  return {
    range: { from, to },
    daily: [...daily.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ key: k, label: dayLabel(k), ...v })),
    monthly: [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ key: k, label: monthLabel(k), ...v })),
    byCategory: [...byCategory.entries()].map(([k, v]) => ({ category: k, sum: v })),
    totals: {
      collection: m2(paymentRows.reduce((s, p) => s + p.amount, 0)),
      expense: m2(expenseRows.reduce((s, e) => s + e.amount, 0)),
    },
    partyDues: partyRows.map((p) => ({ ...p, bill: m2(p.bill), paid: m2(p.paid), due: m2(p.bill - p.paid) })),
    customerDues: customerRows
      .map((c) => ({ ...c, bill: m2(c.bill), paid: m2(c.paid), due: m2(c.bill - c.paid) }))
      .filter((c) => c.due !== 0 || c.bill > 0),
    factories: factoryRows.map((f) => ({ ...f, openingDue: m2(f.openingDue), paid: m2(f.paid), due: m2(f.openingDue - f.paid) })),
    orderCounts: { regular: roCounts, packaging: poCounts },
    tasks: taskRows,
  };
}
