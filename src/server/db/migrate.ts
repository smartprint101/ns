import { getDb, dbDriver, type DB } from "./index";
import { seedIfEmpty } from "./seed-core";

/** Apply SQL migrations from ./drizzle, then auto-seed on an empty database. */
export async function runMigrationsAndSeed(): Promise<void> {
  const driver = dbDriver();
  const db = await getDb();
  await runMigrations(db, driver);
  await seedIfEmpty(db);
}

export async function runMigrations(db?: DB, driver?: string): Promise<void> {
  const d = driver ?? dbDriver();
  const inst = db ?? (await getDb());
  if (d === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(inst as never, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(inst as never, { migrationsFolder: "./drizzle" });
  }
}
