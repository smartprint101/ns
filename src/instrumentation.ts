export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const driver = process.env.DB_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "pglite");
    // Embedded dev DB → always auto-migrate + seed on boot.
    // Production → run `npm run db:migrate` (documented), or set RUN_MIGRATIONS=1.
    if (driver === "pglite" || process.env.RUN_MIGRATIONS === "1") {
      const { runMigrationsAndSeed } = await import("@/server/db/migrate");
      await runMigrationsAndSeed();
      console.log("[db] migrations + seed check complete");
    }
  }
}
