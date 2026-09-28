import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const driver =
  process.env.DB_DRIVER === "pglite" || process.env.DB_DRIVER === "postgres"
    ? process.env.DB_DRIVER
    : process.env.DATABASE_URL
      ? "postgres"
      : "pglite";

// drizzle-kit generate → pure offline schema diff → SQL files in ./drizzle
// drizzle-kit migrate  → applies them (pglite data dir or real DATABASE_URL)
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  ...(driver === "pglite"
    ? { driver: "pglite", dbCredentials: { url: process.env.PGLITE_DATA_DIR || "./.pgdata" } }
    : { dbCredentials: { url: process.env.DATABASE_URL as string } }),
});
