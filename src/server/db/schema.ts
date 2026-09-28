// ─────────────────────────────────────────────────────────────────────────────
// এনএস ট্রেডার্স — Database Schema (Drizzle ORM · PostgreSQL)
// Money is numeric(14,2). Every taka movement writes an AccountTransaction row
// inside the same DB transaction as its Payment/Expense — one source of truth.
// ─────────────────────────────────────────────────────────────────────────────
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const kg = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const ts = (name: string) => timestamp(name, { mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["OWNER", "STAFF"]);
export const recordStatusEnum = pgEnum("record_status", ["ACTIVE", "COMPLETED", "CANCELLED"]);
export const regularStageEnum = pgEnum("regular_stage", [
  "PLACED",
  "READY",
  "COURIER_GIVEN",
  "CONDITION_PENDING",
  "COMPLETED",
]);
export const workTypeEnum = pgEnum("work_type", ["CYLINDER_PACKET", "PACKET", "ART_PAPER"]);
export const packagingStageEnum = pgEnum("packaging_stage", [
  "PLACED",
  "ADVANCE",
  "DESIGN",
  "CYLINDER_SENT",
  "CYLINDER_READY",
  "PRODUCTION",
  "PRODUCTION_DONE",
  "MATERIAL_RECEIVED",
  "DELIVERED",
  "COMPLETED",
]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "FACTORY",
  "PURCHASE",
  "COURIER",
  "PACKAGING",
  "TRANSPORT",
  "OTHER",
]);
export const accountKindEnum = pgEnum("account_kind", ["CASH", "BANK", "MOBILE"]);
export const txnKindEnum = pgEnum("txn_kind", [
  "PAYMENT_IN",
  "PAYMENT_REVERSAL",
  "EXPENSE_OUT",
  "EXPENSE_REVERSAL",
  "ADJUSTMENT",
]);
export const paymentSourceEnum = pgEnum("payment_source", ["MANUAL", "CONDITION", "COURIER_COLLECTION"]);
export const taskStatusEnum = pgEnum("task_status", ["PENDING", "COMPLETED", "CANCELLED"]);
export const collectionStatusEnum = pgEnum("collection_status", ["PENDING", "RECEIVED", "CANCELLED"]);

// ── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("STAFF"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Masters ──────────────────────────────────────────────────────────────────
export const regularCustomers = pgTable(
  "regular_customers",
  {
    id: id(),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    address: text("address"),
    notes: text("notes"),
    /** বকেয়া পেজে "নিচে পাঠানো" — সেট থাকলে এই কাস্টমার লিস্টের নিচে থাকবে। */
    duesDemotedAt: ts("dues_demoted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("rc_name_idx").on(t.name), index("rc_phone_idx").on(t.phone)]
);

export const packagingParties = pgTable("packaging_parties", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const factories = pgTable("factories", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  notes: text("notes"),
  openingDue: money("opening_due").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cylinders = pgTable(
  "cylinders",
  {
    id: id(),
    name: varchar("name", { length: 200 }).notNull().unique(),
    factoryId: text("factory_id")
      .notNull()
      .references(() => factories.id),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cyl_factory_idx").on(t.factoryId)]
);

// ── Regular Orders ───────────────────────────────────────────────────────────
export const regularOrders = pgTable(
  "regular_orders",
  {
    id: id(),
    orderNo: serial("order_no").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => regularCustomers.id),
    productName: varchar("product_name", { length: 250 }),
    quantity: kg("quantity"),
    price: money("price"),
    deliveryCharge: money("delivery_charge").notNull().default(0),
    totalAmount: money("total_amount").notNull(),
    address: text("address"),
    notes: text("notes"),
    hasCondition: boolean("has_condition").notNull().default(false),
    stage: regularStageEnum("stage").notNull().default("PLACED"),
    status: recordStatusEnum("status").notNull().default("ACTIVE"),
    courierGivenAt: ts("courier_given_at"),
    conditionAmount: money("condition_amount"),
    conditionReceivedAt: ts("condition_received_at"),
    completedAt: ts("completed_at"),
    cancelReason: text("cancel_reason"),
    cancelledAt: ts("cancelled_at"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    updatedById: text("updated_by_id").references(() => users.id),
    cancelledById: text("cancelled_by_id").references(() => users.id),
    conditionReceivedById: text("condition_received_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ro_status_stage_idx").on(t.status, t.stage, t.createdAt),
    index("ro_customer_idx").on(t.customerId),
  ]
);

// ── Packaging Orders ─────────────────────────────────────────────────────────
export const packagingOrders = pgTable(
  "packaging_orders",
  {
    id: id(),
    orderNo: serial("order_no").notNull().unique(),
    partyId: text("party_id")
      .notNull()
      .references(() => packagingParties.id),
    workType: workTypeEnum("work_type").notNull(),
    totalKg: kg("total_kg").notNull(),
    extraKg: kg("extra_kg").notNull().default(0),
    finalKg: kg("final_kg").notNull(),
    totalBill: money("total_bill").notNull(),
    factoryId: text("factory_id").references(() => factories.id),
    cylinderId: text("cylinder_id").references(() => cylinders.id),
    notes: text("notes"),
    stage: packagingStageEnum("stage").notNull().default("PLACED"),
    status: recordStatusEnum("status").notNull().default("ACTIVE"),
    completedAt: ts("completed_at"),
    cancelReason: text("cancel_reason"),
    cancelledAt: ts("cancelled_at"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    updatedById: text("updated_by_id").references(() => users.id),
    cancelledById: text("cancelled_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("po_status_stage_idx").on(t.status, t.stage, t.createdAt),
    index("po_party_idx").on(t.partyId),
  ]
);

// ── Accounts & Ledger ────────────────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: id(),
  key: varchar("key", { length: 40 }).notNull().unique(), // CASH, DBBL, BRAC, BKASH, NAGAD
  nameBn: varchar("name_bn", { length: 120 }).notNull(),
  kind: accountKindEnum("kind").notNull(),
  openingBalance: money("opening_balance").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accountTransactions = pgTable(
  "account_transactions",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    amount: money("amount").notNull(), // signed
    kind: txnKindEnum("kind").notNull(),
    paymentId: text("payment_id"),
    expenseId: text("expense_id"),
    adjustmentId: text("adjustment_id"),
    note: text("note"),
    date: ts("date").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("at_account_date_idx").on(t.accountId, t.date)]
);

export const adjustments = pgTable("adjustments", {
  id: id(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  amount: money("amount").notNull(), // signed
  reason: text("reason").notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

// ── Payments ─────────────────────────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: id(),
    txnNo: serial("txn_no").notNull().unique(),
    amount: money("amount").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    partyId: text("party_id").references(() => packagingParties.id),
    customerId: text("customer_id").references(() => regularCustomers.id),
    source: paymentSourceEnum("source").notNull().default("MANUAL"),
    isAdvance: boolean("is_advance").notNull().default(false),
    /** কালেকশন পেজের হিসাবে দেখাবে কি না ("কালেকশনে এড হবে" টগল)। */
    inCollections: boolean("in_collections").notNull().default(false),
    date: ts("date").notNull().defaultNow(),
    notes: text("notes"),
    voidedAt: ts("voided_at"),
    voidReason: text("void_reason"),
    replacedById: text("replaced_by_id"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    updatedById: text("updated_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("pay_date_idx").on(t.date),
    index("pay_party_idx").on(t.partyId),
    index("pay_customer_idx").on(t.customerId),
  ]
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: id(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id),
    amount: money("amount").notNull(),
    regularOrderId: text("regular_order_id").references(() => regularOrders.id),
    packagingOrderId: text("packaging_order_id").references(() => packagingOrders.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("pa_regular_idx").on(t.regularOrderId),
    index("pa_packaging_idx").on(t.packagingOrderId),
    index("pa_payment_idx").on(t.paymentId),
  ]
);

// ── Expenses ─────────────────────────────────────────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    amount: money("amount").notNull(),
    category: expenseCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    date: ts("date").notNull().defaultNow(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    partyId: text("party_id").references(() => packagingParties.id),
    factoryId: text("factory_id").references(() => factories.id),
    regularOrderId: text("regular_order_id").references(() => regularOrders.id),
    packagingOrderId: text("packaging_order_id").references(() => packagingOrders.id),
    taskId: text("task_id").references(() => tasks.id),
    voidedAt: ts("voided_at"),
    voidReason: text("void_reason"),
    replacedById: text("replaced_by_id"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    updatedById: text("updated_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("exp_date_idx").on(t.date), index("exp_category_idx").on(t.category)]
);

// ── Courier Collections ──────────────────────────────────────────────────────
export const courierCollections = pgTable(
  "courier_collections",
  {
    id: id(),
    title: varchar("title", { length: 200 }).notNull(),
    expectedAmount: money("expected_amount").notNull(),
    receivedAmount: money("received_amount"),
    accountId: text("account_id").references(() => accounts.id),
    paymentId: text("payment_id"),
    status: collectionStatusEnum("status").notNull().default("PENDING"),
    date: ts("date").notNull().defaultNow(),
    receivedAt: ts("received_at"),
    notes: text("notes"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    receivedById: text("received_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cc_status_idx").on(t.status, t.createdAt)]
);

// ── Creditors / Payables ─────────────────────────────────────────────────────
export const creditors = pgTable(
  "creditors",
  {
    id: id(),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    amount: money("amount").notNull(),
    notes: text("notes"),
    status: recordStatusEnum("status").notNull().default("ACTIVE"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    updatedById: text("updated_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cred_status_idx").on(t.status, t.createdAt), index("cred_name_idx").on(t.name)]
);

// ── Tasks ────────────────────────────────────────────────────────────────────
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: varchar("title", { length: 250 }).notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("PENDING"),
    completionNote: text("completion_note"),
    /** অটো-টাস্ক লিংক: "নতুন অর্ডারের স্লিপ করো" শেষ হলে অর্ডারের ধাপ এগোয়। */
    regularOrderId: text("regular_order_id").references(() => regularOrders.id),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    assignedToId: text("assigned_to_id")
      .notNull()
      .references(() => users.id),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    completedById: text("completed_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("task_status_idx").on(t.status, t.createdAt)]
);

// ── Notifications & Event Log ────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 40 }).notNull(),
    message: text("message").notNull(),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.readAt)]
);

/** One row per browser/device that a user has enabled for Web Push. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)]
);

/** Stable VAPID key pair shared by all app instances; the private key never reaches the client. */
export const pushSettings = pgTable("push_settings", {
  id: varchar("id", { length: 20 }).primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: createdAt(),
});

export const eventLogs = pgTable(
  "event_logs",
  {
    id: id(),
    entity: varchar("entity", { length: 40 }).notNull(), // REGULAR_ORDER, PACKAGING_ORDER, ...
    entityId: text("entity_id").notNull(),
    action: varchar("action", { length: 40 }).notNull(), // CREATED, STAGE, PAYMENT, ...
    detail: text("detail"),
    actorId: text("actor_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("ev_entity_idx").on(t.entity, t.entityId, t.createdAt)]
);

// ── Relations ────────────────────────────────────────────────────────────────
export const userRelations = relations(users, ({ many }) => ({
  regularOrdersCreated: many(regularOrders, { relationName: "roCreated" }),
  regularOrdersUpdated: many(regularOrders, { relationName: "roUpdated" }),
  regularOrdersCancelled: many(regularOrders, { relationName: "roCancelled" }),
  conditionsReceived: many(regularOrders, { relationName: "roCondition" }),
  packagingOrdersCreated: many(packagingOrders, { relationName: "poCreated" }),
  packagingOrdersUpdated: many(packagingOrders, { relationName: "poUpdated" }),
  packagingOrdersCancelled: many(packagingOrders, { relationName: "poCancelled" }),
  paymentsCreated: many(payments, { relationName: "payCreated" }),
  paymentsUpdated: many(payments, { relationName: "payUpdated" }),
  expensesCreated: many(expenses, { relationName: "expCreated" }),
  expensesUpdated: many(expenses, { relationName: "expUpdated" }),
  tasksAssigned: many(tasks, { relationName: "taskAssigned" }),
  tasksCreated: many(tasks, { relationName: "taskCreated" }),
  tasksCompleted: many(tasks, { relationName: "taskCompleted" }),
  collectionsCreated: many(courierCollections, { relationName: "ccCreated" }),
  collectionsReceived: many(courierCollections, { relationName: "ccReceived" }),
  creditorsCreated: many(creditors, { relationName: "credCreated" }),
  creditorsUpdated: many(creditors, { relationName: "credUpdated" }),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
  adjustments: many(adjustments),
}));

export const regularCustomerRelations = relations(regularCustomers, ({ many }) => ({
  orders: many(regularOrders),
  payments: many(payments),
}));

export const packagingPartyRelations = relations(packagingParties, ({ many }) => ({
  orders: many(packagingOrders),
  payments: many(payments),
  expenses: many(expenses),
}));

export const factoryRelations = relations(factories, ({ many }) => ({
  cylinders: many(cylinders),
  orders: many(packagingOrders),
  expenses: many(expenses),
}));

export const cylinderRelations = relations(cylinders, ({ one, many }) => ({
  factory: one(factories, { fields: [cylinders.factoryId], references: [factories.id] }),
  orders: many(packagingOrders),
}));

export const regularOrderRelations = relations(regularOrders, ({ one, many }) => ({
  customer: one(regularCustomers, { fields: [regularOrders.customerId], references: [regularCustomers.id] }),
  createdBy: one(users, { fields: [regularOrders.createdById], references: [users.id], relationName: "roCreated" }),
  updatedBy: one(users, { fields: [regularOrders.updatedById], references: [users.id], relationName: "roUpdated" }),
  cancelledBy: one(users, { fields: [regularOrders.cancelledById], references: [users.id], relationName: "roCancelled" }),
  conditionReceivedBy: one(users, {
    fields: [regularOrders.conditionReceivedById],
    references: [users.id],
    relationName: "roCondition",
  }),
  allocations: many(paymentAllocations),
  expenses: many(expenses),
}));

export const packagingOrderRelations = relations(packagingOrders, ({ one, many }) => ({
  party: one(packagingParties, { fields: [packagingOrders.partyId], references: [packagingParties.id] }),
  factory: one(factories, { fields: [packagingOrders.factoryId], references: [factories.id] }),
  cylinder: one(cylinders, { fields: [packagingOrders.cylinderId], references: [cylinders.id] }),
  createdBy: one(users, { fields: [packagingOrders.createdById], references: [users.id], relationName: "poCreated" }),
  updatedBy: one(users, { fields: [packagingOrders.updatedById], references: [users.id], relationName: "poUpdated" }),
  cancelledBy: one(users, { fields: [packagingOrders.cancelledById], references: [users.id], relationName: "poCancelled" }),
  allocations: many(paymentAllocations),
  expenses: many(expenses),
}));

export const accountRelations = relations(accounts, ({ many }) => ({
  payments: many(payments),
  expenses: many(expenses),
  transactions: many(accountTransactions),
  adjustments: many(adjustments),
}));

export const accountTransactionRelations = relations(accountTransactions, ({ one }) => ({
  account: one(accounts, { fields: [accountTransactions.accountId], references: [accounts.id] }),
}));

export const adjustmentRelations = relations(adjustments, ({ one }) => ({
  account: one(accounts, { fields: [adjustments.accountId], references: [accounts.id] }),
  createdBy: one(users, { fields: [adjustments.createdById], references: [users.id] }),
}));

export const paymentRelations = relations(payments, ({ one, many }) => ({
  account: one(accounts, { fields: [payments.accountId], references: [accounts.id] }),
  party: one(packagingParties, { fields: [payments.partyId], references: [packagingParties.id] }),
  customer: one(regularCustomers, { fields: [payments.customerId], references: [regularCustomers.id] }),
  createdBy: one(users, { fields: [payments.createdById], references: [users.id], relationName: "payCreated" }),
  updatedBy: one(users, { fields: [payments.updatedById], references: [users.id], relationName: "payUpdated" }),
  allocations: many(paymentAllocations),
}));

export const paymentAllocationRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, { fields: [paymentAllocations.paymentId], references: [payments.id] }),
  regularOrder: one(regularOrders, { fields: [paymentAllocations.regularOrderId], references: [regularOrders.id] }),
  packagingOrder: one(packagingOrders, { fields: [paymentAllocations.packagingOrderId], references: [packagingOrders.id] }),
}));

export const expenseRelations = relations(expenses, ({ one }) => ({
  account: one(accounts, { fields: [expenses.accountId], references: [accounts.id] }),
  party: one(packagingParties, { fields: [expenses.partyId], references: [packagingParties.id] }),
  factory: one(factories, { fields: [expenses.factoryId], references: [factories.id] }),
  regularOrder: one(regularOrders, { fields: [expenses.regularOrderId], references: [regularOrders.id] }),
  packagingOrder: one(packagingOrders, { fields: [expenses.packagingOrderId], references: [packagingOrders.id] }),
  task: one(tasks, { fields: [expenses.taskId], references: [tasks.id] }),
  createdBy: one(users, { fields: [expenses.createdById], references: [users.id], relationName: "expCreated" }),
  updatedBy: one(users, { fields: [expenses.updatedById], references: [users.id], relationName: "expUpdated" }),
}));

export const courierCollectionRelations = relations(courierCollections, ({ one }) => ({
  account: one(accounts, { fields: [courierCollections.accountId], references: [accounts.id] }),
  createdBy: one(users, { fields: [courierCollections.createdById], references: [users.id], relationName: "ccCreated" }),
  receivedBy: one(users, { fields: [courierCollections.receivedById], references: [users.id], relationName: "ccReceived" }),
}));

export const creditorRelations = relations(creditors, ({ one }) => ({
  createdBy: one(users, { fields: [creditors.createdById], references: [users.id], relationName: "credCreated" }),
  updatedBy: one(users, { fields: [creditors.updatedById], references: [users.id], relationName: "credUpdated" }),
}));

export const taskRelations = relations(tasks, ({ one, many }) => ({
  assignedTo: one(users, { fields: [tasks.assignedToId], references: [users.id], relationName: "taskAssigned" }),
  createdBy: one(users, { fields: [tasks.createdById], references: [users.id], relationName: "taskCreated" }),
  completedBy: one(users, { fields: [tasks.completedById], references: [users.id], relationName: "taskCompleted" }),
  expenses: many(expenses),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const pushSubscriptionRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));

export const eventLogRelations = relations(eventLogs, ({ one }) => ({
  actor: one(users, { fields: [eventLogs.actorId], references: [users.id] }),
}));

// ── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type RegularCustomer = typeof regularCustomers.$inferSelect;
export type PackagingParty = typeof packagingParties.$inferSelect;
export type Factory = typeof factories.$inferSelect;
export type Cylinder = typeof cylinders.$inferSelect;
export type RegularOrder = typeof regularOrders.$inferSelect;
export type PackagingOrder = typeof packagingOrders.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type AccountTransaction = typeof accountTransactions.$inferSelect;
export type Adjustment = typeof adjustments.$inferSelect;
export type CourierCollection = typeof courierCollections.$inferSelect;
export type Creditor = typeof creditors.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type EventLog = typeof eventLogs.$inferSelect;
