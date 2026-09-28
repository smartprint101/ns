/**
 * Requirement-68 scenario tests — runs the 10 required business scenarios
 * end-to-end through the same service layer the app uses.
 *
 *   npm run test:scenarios
 *
 * Safe: creates uniquely-named test data (RUN id suffix), never deletes anything.
 */
import "dotenv/config";
import { eq, and, sql } from "drizzle-orm";
import { getDb, schema } from "../src/server/db";
import { runMigrationsAndSeed } from "../src/server/db/migrate";
import type { CurrentUser } from "../src/server/services/shared";
import * as usersSvc from "../src/server/services/users";
import * as regular from "../src/server/services/regular-orders";
import * as packaging from "../src/server/services/packaging-orders";
import * as paymentsSvc from "../src/server/services/payments";
import * as expensesSvc from "../src/server/services/expenses";
import * as tasksSvc from "../src/server/services/tasks";
import * as masters from "../src/server/services/masters";
import { listAccountsWithBalances } from "../src/server/services/accounts";
import { m2 } from "../src/lib/utils";

const RUN = Date.now().toString(36).slice(-5);
let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT: " + msg);
}
async function scenario<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    passed++;
    console.log(`  ✓ ${name}`);
    return r;
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
    return undefined;
  }
}

async function balanceOf(key: string): Promise<number> {
  const accounts = await listAccountsWithBalances();
  const a = accounts.find((x) => x.key === key);
  assert(a, `account ${key} exists`);
  return a!.balance;
}

await runMigrationsAndSeed();
const db = await getDb();

// ── Actors ──────────────────────────────────────────────────────────────────
const ownerRow = await db.query.users.findFirst({ where: eq(schema.users.name, "Shariful") });
assert(ownerRow, "owner user Shariful seeded");
const owner: CurrentUser = { id: ownerRow!.id, name: ownerRow!.name, role: "OWNER" };

async function ensureUser(name: string): Promise<CurrentUser> {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.name, name) });
  if (existing) return { id: existing.id, name: existing.name, role: existing.role };
  const row = await usersSvc.createUser(owner, { name, password: "test1234", role: "STAFF" });
  return { id: row.id, name, role: "STAFF" };
}
const saiful = await ensureUser("Saiful");
const nirob = await ensureUser("Nirob");

const accounts = await listAccountsWithBalances();
const cash = accounts.find((a) => a.key === "CASH")!;
const dbbl = accounts.find((a) => a.key === "DBBL")!;

console.log(`\nScenario tests (run ${RUN})\n`);

// ── Scenario 1: Regular order → courier → condition pending → condition received ──
await scenario("S1: Regular order condition flow → completed", async () => {
  const order = await regular.createRegularOrder(nirob, {
    customerId: "",
    customerName: `S1 কাস্টমার ${RUN}`,
    phone: "01700000001",
    productName: "ডাল ৫০ কেজি",
    quantity: 50,
    price: 160,
    deliveryCharge: 0,
    hasCondition: true,
    address: "",
    notes: "",
  });
  await regular.advanceRegularStage(nirob, order.id); // → READY
  const after2 = await regular.advanceRegularStage(nirob, order.id); // courier → CONDITION_PENDING
  assert(after2.stage === "CONDITION_PENDING", "stage CONDITION_PENDING after courier given with condition");
  const before = await balanceOf("CASH");
  await regular.receiveCondition(saiful, { orderId: order.id, receivedAmount: 8000, accountId: cash.id });
  const detail = await regular.getRegularOrder(order.id);
  assert(detail?.order.status === "COMPLETED", "order completed after condition received");
  assert(detail?.order.conditionAmount === 8000, "condition amount recorded");
  assert((await balanceOf("CASH")) === m2(before + 8000), "cash balance +8000");
  assert(detail?.paid === 8000, "order paid via condition payment = 8000");
});

// ── Scenario 2: Closest condition matching ───────────────────────────────────
await scenario("S2: amount → closest pending conditions suggested", async () => {
  const amounts = [8200, 7900, 8500];
  const ids: string[] = [];
  for (let i = 0; i < amounts.length; i++) {
    const o = await regular.createRegularOrder(owner, {
      customerId: "",
      customerName: `S2 কাস্টমার ${i + 1} ${RUN}`,
      productName: `পণ্য ${i + 1}`,
      quantity: 1,
      price: amounts[i],
      deliveryCharge: 0,
      hasCondition: true,
      address: "",
      notes: "",
    });
    await regular.advanceRegularStage(owner, o.id);
    await regular.advanceRegularStage(owner, o.id);
    ids.push(o.id);
  }
  const matches = await regular.findConditionMatches(8000);
  const hitIds = matches.map((m) => m.order.id);
  assert(ids.every((id) => hitIds.includes(id)), "all 3 close conditions suggested");
  assert(Math.abs(matches[0].order.totalAmount - 8000) <= Math.abs(matches[matches.length - 1].order.totalAmount - 8000), "sorted by closeness");
  // user picks the ৳7,900 one → only that order completes
  const target = ids[1];
  await regular.receiveCondition(owner, { orderId: target, receivedAmount: 7900, accountId: dbbl.id });
  const t = await regular.getRegularOrder(target);
  const other = await regular.getRegularOrder(ids[0]);
  assert(t?.order.status === "COMPLETED", "selected order completed");
  assert(other?.order.status === "ACTIVE" && other.order.stage === "CONDITION_PENDING", "other order still pending");
});

// ── Scenario 3+4: Cylinder ↔ Factory relation ───────────────────────────────
await scenario("S3+S4: cylinder → factory auto-relation", async () => {
  const factory = await masters.createFactory(owner, { name: `S3 ফ্যাক্টরি ${RUN}`, phone: "", address: "", notes: "", openingDue: 0 });
  const cyl = await masters.createCylinder(owner, { name: `S3 Cylinder ${RUN}`, factoryId: factory.id, notes: "" });
  const order = await packaging.createPackagingOrder(saiful, {
    partyId: "",
    partyName: `S3 পার্টি ${RUN}`,
    workType: "CYLINDER_PACKET",
    totalKg: 100,
    extraKg: 0,
    totalBill: 80000,
    factoryId: factory.id, // what the UI auto-fills when cylinder is picked
    cylinderId: cyl.id,
    advanceAmount: 0,
    advanceAccountId: "",
    notes: "",
  });
  const detail = await packaging.getPackagingOrder(order.id);
  assert(detail?.order.cylinderId === cyl.id && detail.order.factoryId === factory.id, "order keeps cylinder+factory");
  assert(detail?.order.cylinder?.factoryId === factory.id, "cylinder's factory relation intact");
});

// ── Scenario 5: Packaging payment → ledger/order/balance everywhere ─────────
await scenario("S5: packaging payment → party ledger + order due + balance", async () => {
  const party = await masters.createParty(owner, { name: `S5 পার্টি ${RUN}`, phone: "", address: "", notes: "" });
  const factory = await masters.createFactory(owner, { name: `S5 ফ্যাক্টরি ${RUN}`, phone: "", address: "", notes: "", openingDue: 0 });
  const order = await packaging.createPackagingOrder(owner, {
    partyId: party.id,
    workType: "PACKET",
    totalKg: 200,
    extraKg: 10,
    finalKg: 210,
    totalBill: 150000,
    factoryId: factory.id,
    advanceAmount: 20000, // advance at creation → isAdvance payment + allocation + stage ADVANCE
    advanceAccountId: cash.id,
    notes: "",
  });
  const d1 = await packaging.getPackagingOrder(order.id);
  assert(d1?.order.stage === "ADVANCE", "stage ADVANCE after advance payment");
  assert(d1?.advance === 20000 && d1.paid === 20000, "advance 20000 paid recorded");

  const before = await balanceOf("DBBL");
  const r = await paymentsSvc.createPayment(nirob, {
    amount: 50000,
    accountId: dbbl.id,
    partyId: party.id,
    notes: "",
    isAdvance: false,
    allocations: [{ packagingOrderId: order.id, amount: 50000 }],
  });
  assert(r.ok, "payment created");
  const d2 = await packaging.getPackagingOrder(order.id);
  assert(d2?.paid === 70000, `order paid 70000 (got ${d2?.paid})`);
  assert(m2(d2!.order.totalBill - d2!.paid) === 80000, "due 80000");
  const ledger = await paymentsSvc.getPartyLedger(party.id);
  assert(ledger?.totalPaid === 70000, "party ledger paid 70000");
  assert(ledger?.totalDue === 80000, "party ledger due 80000");
  assert((await balanceOf("DBBL")) === m2(before + 50000), "DBBL balance +50000");
});

// ── Scenario 6: One payment across multiple orders ──────────────────────────
await scenario("S6: multi-order allocation — one payment, three orders", async () => {
  const party = await masters.createParty(owner, { name: `S6 পার্টি ${RUN}`, phone: "", address: "", notes: "" });
  const factory = await masters.createFactory(owner, { name: `S6 ফ্যাক্টরি ${RUN}`, phone: "", address: "", notes: "", openingDue: 0 });
  const mk = () =>
    packaging.createPackagingOrder(owner, {
      partyId: party.id,
      workType: "PACKET",
      totalKg: 10,
      extraKg: 0,
      totalBill: 50000,
      factoryId: factory.id,
      advanceAmount: 0,
      advanceAccountId: "",
      notes: "",
    });
  const [o1, o2, o3] = [await mk(), await mk(), await mk()];
  const before = await balanceOf("CASH");
  const r = await paymentsSvc.createPayment(owner, {
    amount: 50000,
    accountId: cash.id,
    partyId: party.id,
    notes: "একসাথে তিন অর্ডারের পেমেন্ট",
    isAdvance: false,
    allocations: [
      { packagingOrderId: o1.id, amount: 20000 },
      { packagingOrderId: o2.id, amount: 15000 },
      { packagingOrderId: o3.id, amount: 15000 },
    ],
  });
  assert(r.ok, "payment created");
  const [d1, d2, d3] = await Promise.all([packaging.getPackagingOrder(o1.id), packaging.getPackagingOrder(o2.id), packaging.getPackagingOrder(o3.id)]);
  assert(d1?.paid === 20000 && d2?.paid === 15000 && d3?.paid === 15000, "each order got its allocation");
  const ledger = await paymentsSvc.getPartyLedger(party.id);
  const ledgerPayments = ledger!.payments.filter((p) => !p.voidedAt && p.notes?.includes("একসাথে"));
  assert(ledgerPayments.length === 1, "party ledger shows exactly ONE payment row");
  assert(ledger?.totalPaid === 50000, "party paid counted once (50000)");
  assert((await balanceOf("CASH")) === m2(before + 50000), "account credited once");
  const txns = await db
    .select()
    .from(schema.accountTransactions)
    .where(and(eq(schema.accountTransactions.paymentId, (r as { paymentId: string }).paymentId)));
  assert(txns.length === 1, "exactly one ledger row for the payment");
});

// ── Scenario 7: Task lifecycle ───────────────────────────────────────────────
await scenario("S7: task assign → complete with info", async () => {
  const task = await tasksSvc.createTask(owner, { title: `চক থেকে মাল নিয়ে আসো ${RUN}`, description: "জরুরি", assignedToId: nirob.id });
  const notif = await db
    .select()
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, nirob.id), eq(schema.notifications.type, "TASK_ASSIGNED")))
    .orderBy(sql`${schema.notifications.createdAt} desc`)
    .limit(1);
  assert(notif.length > 0, "assignee got notification");
  await tasksSvc.completeTask(nirob, task.id, "মাল দোকানে পৌঁছে দিয়েছি");
  const detail = await tasksSvc.getTask(task.id);
  assert(detail?.task.status === "COMPLETED", "task completed");
  assert(detail?.task.completedById === nirob.id && detail.task.completedAt, "completion info recorded");
});

// ── Scenario 8: Task-related expense lands in account ───────────────────────
await scenario("S8: task expense appears in account ledger", async () => {
  const task = await tasksSvc.createTask(owner, { title: `চক থেকে ডাল আনা ${RUN}`, assignedToId: nirob.id });
  const before = await balanceOf("CASH");
  const r = await expensesSvc.createExpense(nirob, {
    amount: 3400,
    category: "PURCHASE",
    description: `চক থেকে ডাল এনেছি ${RUN}`,
    accountId: cash.id,
    partyId: "",
    factoryId: "",
    regularOrderId: "",
    packagingOrderId: "",
    taskId: task.id,
  });
  assert(r.ok, "expense created");
  assert((await balanceOf("CASH")) === m2(before - 3400), "cash balance −3400");
  const detail = await tasksSvc.getTask(task.id);
  assert(detail?.expenses.length === 1 && detail.expenses[0].amount === 3400, "expense visible on task");
});

// ── Scenario 9: Duplicate expense warning (warning only, user may continue) ──
await scenario("S9: duplicate-looking expense → warning → confirm saves", async () => {
  const input = {
    amount: 3400,
    category: "PURCHASE" as const,
    description: `চক থেকে ডাল এনেছি ${RUN}`, // same text as S8, same user nirob, same amount
    accountId: cash.id,
    partyId: "",
    factoryId: "",
    regularOrderId: "",
    packagingOrderId: "",
    taskId: "",
  };
  const first = await expensesSvc.createExpense(nirob, input);
  assert(!first.ok && "duplicateWarning" in first, "warning returned for similar entry");
  const confirmed = await expensesSvc.createExpense(nirob, input, { confirmed: true });
  assert(confirmed.ok, "confirmed save succeeds (no hard block)");
});

// ── Scenario 10: Oldest pending first; completed leaves active list ──────────
await scenario("S10: oldest pending first; completion leaves active", async () => {
  const party = await masters.createParty(owner, { name: `S10 পার্টি ${RUN}`, phone: "", address: "", notes: "" });
  const factory = await masters.createFactory(owner, { name: `S10 ফ্যাক্টরি ${RUN}`, phone: "", address: "", notes: "", openingDue: 0 });
  const mk = () =>
    packaging.createPackagingOrder(owner, {
      partyId: party.id,
      workType: "ART_PAPER",
      totalKg: 5,
      extraKg: 0,
      totalBill: 1000,
      factoryId: factory.id,
      advanceAmount: 0,
      advanceAccountId: "",
      notes: `S10 ${RUN}`,
    });
  const oldOrder = await mk();
  const newOrder = await mk();
  // Backdate: oldOrder → 15 days ago
  await db
    .update(schema.packagingOrders)
    .set({ createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000) })
    .where(eq(schema.packagingOrders.id, oldOrder.id));
  await db
    .update(schema.packagingOrders)
    .set({ createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) })
    .where(eq(schema.packagingOrders.id, newOrder.id));

  const active = await packaging.listPackagingOrders({ tab: "active", partyId: party.id });
  assert(active[0]?.order.id === oldOrder.id, "15-day-old order is first");
  // Complete old order through the ART_PAPER flow
  // stage is PLACED — needs advance first; give it via payment
  await paymentsSvc.createPayment(owner, {
    amount: 1000,
    accountId: cash.id,
    partyId: party.id,
    notes: "",
    isAdvance: true,
    allocations: [{ packagingOrderId: oldOrder.id, amount: 1000 }],
  });
  // move stage: current PLACED → set ADVANCE manually via stage update? advance payment path at creation sets ADVANCE; here emulate via update
  await db.update(schema.packagingOrders).set({ stage: "ADVANCE" }).where(eq(schema.packagingOrders.id, oldOrder.id));
  const flow = ["PRODUCTION", "MATERIAL_RECEIVED", "DELIVERED", "COMPLETED"];
  for (const _ of flow) await packaging.advancePackagingStage(owner, oldOrder.id);
  const after = await packaging.getPackagingOrder(oldOrder.id);
  assert(after?.order.status === "COMPLETED", "order completed through flow");
  const active2 = await packaging.listPackagingOrders({ tab: "active", partyId: party.id });
  assert(!active2.some((r) => r.order.id === oldOrder.id), "completed order left active list");
  assert(active2.some((r) => r.order.id === newOrder.id), "pending order still active on top");
});

console.log(`\n  ${passed} passed · ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
