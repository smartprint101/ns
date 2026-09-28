import { eq, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

export type SearchResults = {
  regularOrders: { id: string; orderNo: number; label: string; sub: string }[];
  packagingOrders: { id: string; orderNo: number; label: string; sub: string }[];
  customers: { id: string; name: string; sub: string }[];
  parties: { id: string; name: string; sub: string }[];
  factories: { id: string; name: string; sub: string }[];
  cylinders: { id: string; name: string; sub: string }[];
  tasks: { id: string; title: string; sub: string }[];
};

export async function globalSearch(qRaw: string): Promise<SearchResults> {
  const q = qRaw.trim();
  const empty: SearchResults = {
    regularOrders: [],
    packagingOrders: [],
    customers: [],
    parties: [],
    factories: [],
    cylinders: [],
    tasks: [],
  };
  if (q.length < 1) return empty;
  const like = `%${q}%`;
  const db = await getDb();

  const [ros, pos, customers, parties, fact, cyl, t] = await Promise.all([
    db
      .select({
        id: schema.regularOrders.id,
        orderNo: schema.regularOrders.orderNo,
        productName: schema.regularOrders.productName,
        stage: schema.regularOrders.stage,
        status: schema.regularOrders.status,
        customerName: schema.regularCustomers.name,
        phone: schema.regularCustomers.phone,
      })
      .from(schema.regularOrders)
      .innerJoin(schema.regularCustomers, eq(schema.regularCustomers.id, schema.regularOrders.customerId))
      .where(
        or(
          sql`${schema.regularOrders.orderNo}::text ilike ${like}`,
          ilike(schema.regularOrders.productName, like),
          ilike(schema.regularCustomers.name, like),
          ilike(schema.regularCustomers.phone, like)
        )
      )
      .orderBy(sql`${schema.regularOrders.createdAt} desc`)
      .limit(8),
    db
      .select({
        id: schema.packagingOrders.id,
        orderNo: schema.packagingOrders.orderNo,
        workType: schema.packagingOrders.workType,
        stage: schema.packagingOrders.stage,
        status: schema.packagingOrders.status,
        partyName: schema.packagingParties.name,
      })
      .from(schema.packagingOrders)
      .innerJoin(schema.packagingParties, eq(schema.packagingParties.id, schema.packagingOrders.partyId))
      .where(or(sql`${schema.packagingOrders.orderNo}::text ilike ${like}`, sql`'PKG-' || ${schema.packagingOrders.orderNo}::text ilike ${like}`, ilike(schema.packagingParties.name, like)))
      .orderBy(sql`${schema.packagingOrders.createdAt} desc`)
      .limit(8),
    db
      .select()
      .from(schema.regularCustomers)
      .where(or(ilike(schema.regularCustomers.name, like), ilike(schema.regularCustomers.phone, like)))
      .limit(6),
    db
      .select()
      .from(schema.packagingParties)
      .where(or(ilike(schema.packagingParties.name, like), ilike(schema.packagingParties.phone, like)))
      .limit(6),
    db.select().from(schema.factories).where(ilike(schema.factories.name, like)).limit(5),
    db
      .select({ id: schema.cylinders.id, name: schema.cylinders.name, factoryName: schema.factories.name })
      .from(schema.cylinders)
      .innerJoin(schema.factories, eq(schema.factories.id, schema.cylinders.factoryId))
      .where(ilike(schema.cylinders.name, like))
      .limit(5),
    db
      .select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status, assignee: schema.users.name })
      .from(schema.tasks)
      .innerJoin(schema.users, eq(schema.users.id, schema.tasks.assignedToId))
      .where(ilike(schema.tasks.title, like))
      .orderBy(sql`${schema.tasks.createdAt} desc`)
      .limit(6),
  ]);

  return {
    regularOrders: ros.map((r) => ({
      id: r.id,
      orderNo: r.orderNo,
      label: `#${r.orderNo} — ${r.customerName}`,
      sub: `${r.productName} · ${r.status === "CANCELLED" ? "বাতিল" : r.stage}`,
    })),
    packagingOrders: pos.map((r) => ({
      id: r.id,
      orderNo: r.orderNo,
      label: `PKG-${r.orderNo} — ${r.partyName}`,
      sub: `${r.workType} · ${r.status === "CANCELLED" ? "বাতিল" : r.stage}`,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, sub: c.phone ?? "" })),
    parties: parties.map((c) => ({ id: c.id, name: c.name, sub: c.phone ?? "" })),
    factories: fact.map((f) => ({ id: f.id, name: f.name, sub: f.phone ?? "" })),
    cylinders: cyl.map((c) => ({ id: c.id, name: c.name, sub: c.factoryName })),
    tasks: t.map((k) => ({ id: k.id, title: k.title, sub: `${k.assignee} · ${k.status}` })),
  };
}
