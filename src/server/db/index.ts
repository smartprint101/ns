import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export { schema };

type Driver = "pglite" | "postgres";

type Ctx = { db?: DB; driver?: Driver; raw?: unknown };
const g = globalThis as unknown as { __nsdb?: Ctx };

/** Which database driver to use.
 *  Explicit: DB_DRIVER=pglite|postgres
 *  Otherwise: DATABASE_URL present → postgres (production), else embedded PGlite (local dev). */
export function dbDriver(): Driver {
  const d = process.env.DB_DRIVER;
  if (d === "pglite" || d === "postgres") return d;
  return process.env.DATABASE_URL ? "postgres" : "pglite";
}

export async function getDb(): Promise<DB> {
  if (g.__nsdb?.db) return g.__nsdb.db;
  return initDb();
}

export async function initDb(): Promise<DB> {
  const driver = dbDriver();
  if (driver === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dataDir = process.env.PGLITE_DATA_DIR || "./.pgdata";
    const client = new PGlite(dataDir);
    await client.waitReady;
    const db = drizzle(client, { schema }) as unknown as DB;
    g.__nsdb = { db, driver, raw: client };
    return db;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the postgres driver");
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema }) as unknown as DB;
  g.__nsdb = { db, driver, raw: pool };
  return db;
}
