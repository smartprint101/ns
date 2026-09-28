import "dotenv/config";
import { getDb } from "../src/server/db";
import { ensureAccounts, ensureOwnerUser, ensureStaffUsers, seedDemoMasters } from "../src/server/db/seed-core";

const db = await getDb();
await ensureAccounts(db);
await ensureOwnerUser(db);
await ensureStaffUsers(db);
if (process.env.SEED_DEMO === "1") await seedDemoMasters(db);
console.log("✓ seed complete");
process.exit(0);
