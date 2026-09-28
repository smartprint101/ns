import "dotenv/config";
import { runMigrationsAndSeed } from "../src/server/db/migrate";

await runMigrationsAndSeed();
console.log("✓ migrations applied & seed check done");
process.exit(0);
