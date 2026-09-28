import { z } from "zod";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import type { AnyDb, CurrentUser } from "./shared";

// ── Regular Customers ────────────────────────────────────────────────────────
export const customerSchema = z.object({
  name: z.string().trim().min(2, "কাস্টমারের নাম দিন"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export async function listCustomers(q?: string) {
  const db = await getDb();
  const base = db.select().from(schema.regularCustomers).orderBy(asc(schema.regularCustomers.name));
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    return db
      .select()
      .from(schema.regularCustomers)
      .where(or(ilike(schema.regularCustomers.name, like), ilike(schema.regularCustomers.phone, like)))
      .orderBy(asc(schema.regularCustomers.name));
  }
  return base;
}

export async function createCustomer(input: CustomerInput, dbIn?: AnyDb) {
  const data = customerSchema.parse(input);
  const db = dbIn ?? (await getDb());
  const [row] = await db.insert(schema.regularCustomers).values(data).returning();
  return row;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const data = customerSchema.parse(input);
  const db = await getDb();
  const [row] = await db.update(schema.regularCustomers).set(data).where(eq(schema.regularCustomers.id, id)).returning();
  return row;
}

/** Find a customer by exact name (case-insensitive) or create one. Used by order forms. */
export async function findOrCreateCustomer(db: AnyDb, name: string, phone?: string, address?: string) {
  const trimmed = name.trim();
  const existing = await db
    .select()
    .from(schema.regularCustomers)
    .where(sql`lower(${schema.regularCustomers.name}) = lower(${trimmed})`)
    .limit(1);
  if (existing[0]) {
    // Auto-fill latest contact details if they were empty / changed
    if ((phone && !existing[0].phone) || (address && !existing[0].address)) {
      const [u] = await db
        .update(schema.regularCustomers)
        .set({ phone: existing[0].phone ?? phone ?? null, address: existing[0].address ?? address ?? null })
        .where(eq(schema.regularCustomers.id, existing[0].id))
        .returning();
      return u;
    }
    return existing[0];
  }
  const [row] = await db
    .insert(schema.regularCustomers)
    .values({ name: trimmed, phone: phone || null, address: address || null })
    .returning();
  return row;
}

// ── Packaging Parties ────────────────────────────────────────────────────────
export const partySchema = z.object({
  name: z.string().trim().min(2, "পার্টির নাম দিন"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type PartyInput = z.infer<typeof partySchema>;

export async function listParties(q?: string) {
  const db = await getDb();
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    return db
      .select()
      .from(schema.packagingParties)
      .where(or(ilike(schema.packagingParties.name, like), ilike(schema.packagingParties.phone, like)))
      .orderBy(asc(schema.packagingParties.name));
  }
  return db.select().from(schema.packagingParties).orderBy(asc(schema.packagingParties.name));
}

export async function createParty(_actor: CurrentUser, input: PartyInput) {
  const data = partySchema.parse(input);
  const db = await getDb();
  const [row] = await db.insert(schema.packagingParties).values(data).returning();
  return row;
}

export async function updateParty(id: string, input: PartyInput) {
  const data = partySchema.parse(input);
  const db = await getDb();
  const [row] = await db.update(schema.packagingParties).set(data).where(eq(schema.packagingParties.id, id)).returning();
  return row;
}

// ── Factories ────────────────────────────────────────────────────────────────
export const factorySchema = z.object({
  name: z.string().trim().min(2, "ফ্যাক্টরির নাম দিন"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  openingDue: z.coerce.number().min(0, "আগের বাকি ঋণাত্মক হতে পারবে না").default(0),
});
export type FactoryInput = z.infer<typeof factorySchema>;

export async function listFactories() {
  const db = await getDb();
  return db.select().from(schema.factories).orderBy(asc(schema.factories.name));
}

export async function createFactory(_actor: CurrentUser, input: FactoryInput) {
  const data = factorySchema.parse(input);
  const db = await getDb();
  const [row] = await db.insert(schema.factories).values(data).returning();
  return row;
}

export async function updateFactory(id: string, input: FactoryInput) {
  const data = factorySchema.parse(input);
  const db = await getDb();
  const [row] = await db.update(schema.factories).set(data).where(eq(schema.factories.id, id)).returning();
  return row;
}

// ── Cylinders ────────────────────────────────────────────────────────────────
export const cylinderSchema = z.object({
  name: z.string().trim().min(2, "সিলিন্ডারের নাম দিন"),
  factoryId: z.string().min(1, "ফ্যাক্টরি বেছে নিন"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CylinderInput = z.infer<typeof cylinderSchema>;

export async function listCylinders() {
  const db = await getDb();
  return db.query.cylinders.findMany({
    with: { factory: true },
    orderBy: (t, { asc: a }) => [a(t.name)],
  });
}

export async function createCylinder(_actor: CurrentUser, input: CylinderInput) {
  const data = cylinderSchema.parse(input);
  const db = await getDb();
  const [row] = await db.insert(schema.cylinders).values(data).returning();
  return row;
}

export async function updateCylinder(id: string, input: CylinderInput) {
  const data = cylinderSchema.parse(input);
  const db = await getDb();
  const [row] = await db.update(schema.cylinders).set(data).where(eq(schema.cylinders.id, id)).returning();
  return row;
}

// ── Summaries with money aggregates (for list pages) ────────────────────────
export async function listPartySummaries(q?: string) {
  const db = await getDb();
  const { payments, paymentAllocations, packagingOrders } = schema;
  const like = q?.trim() ? `%${q.trim()}%` : null;
  const rows = await db
    .select({
      id: schema.packagingParties.id,
      name: schema.packagingParties.name,
      phone: schema.packagingParties.phone,
      address: schema.packagingParties.address,
      notes: schema.packagingParties.notes,
      bill: sql<number>`coalesce((select sum(o.total_bill)::float8 from ${packagingOrders} o where o.party_id = "packaging_parties"."id" and o.status != 'CANCELLED'), 0)`,
      paid: sql<number>`coalesce((select sum(p.amount)::float8 from ${payments} p where p.party_id = "packaging_parties"."id" and p.voided_at is null), 0)`,
      activeOrders: sql<number>`(select count(*)::int from ${packagingOrders} o where o.party_id = "packaging_parties"."id" and o.status = 'ACTIVE')`,
    })
    .from(schema.packagingParties)
    .where(like ? or(ilike(schema.packagingParties.name, like), ilike(schema.packagingParties.phone, like)) : undefined)
    .orderBy(asc(schema.packagingParties.name));
  void paymentAllocations;
  return rows.map((r) => ({ ...r, due: r.bill - r.paid }));
}

export async function listFactorySummaries() {
  const db = await getDb();
  const { expenses, packagingOrders, cylinders } = schema;
  const rows = await db
    .select({
      id: schema.factories.id,
      name: schema.factories.name,
      phone: schema.factories.phone,
      address: schema.factories.address,
      notes: schema.factories.notes,
      openingDue: schema.factories.openingDue,
      paid: sql<number>`coalesce((select sum(e.amount)::float8 from ${expenses} e where e.factory_id = "factories"."id" and e.voided_at is null), 0)`,
      activeOrders: sql<number>`(select count(*)::int from ${packagingOrders} o where o.factory_id = "factories"."id" and o.status = 'ACTIVE')`,
      cylinders: sql<number>`(select count(*)::int from ${cylinders} c where c.factory_id = "factories"."id")`,
    })
    .from(schema.factories)
    .orderBy(asc(schema.factories.name));
  return rows.map((r) => ({ ...r, due: r.openingDue - r.paid }));
}

export async function listCustomerSummaries(q?: string) {
  const db = await getDb();
  const { regularOrders } = schema;
  const like = q?.trim() ? `%${q.trim()}%` : null;
  const rows = await db
    .select({
      id: schema.regularCustomers.id,
      name: schema.regularCustomers.name,
      phone: schema.regularCustomers.phone,
      address: schema.regularCustomers.address,
      notes: schema.regularCustomers.notes,
      orderCount: sql<number>`(select count(*)::int from ${regularOrders} o where o.customer_id = "regular_customers"."id")`,
      activeOrders: sql<number>`(select count(*)::int from ${regularOrders} o where o.customer_id = "regular_customers"."id" and o.status = 'ACTIVE')`,
    })
    .from(schema.regularCustomers)
    .where(like ? or(ilike(schema.regularCustomers.name, like), ilike(schema.regularCustomers.phone, like)) : undefined)
    .orderBy(asc(schema.regularCustomers.name));
  return rows;
}
