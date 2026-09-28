import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DB } from "./index";
import {
  accounts,
  users,
  factories,
  cylinders,
  packagingParties,
  regularCustomers,
} from "./schema";

export const DEFAULT_ACCOUNTS = [
  { key: "CASH", nameBn: "ক্যাশ", kind: "CASH", sortOrder: 1 },
  { key: "DBBL", nameBn: "ডাচ্-বাংলা ব্যাংক (ডিবিবিএল)", kind: "BANK", sortOrder: 2 },
  { key: "BRAC", nameBn: "ব্র্যাক ব্যাংক", kind: "BANK", sortOrder: 3 },
  { key: "BKASH", nameBn: "বিকাশ", kind: "MOBILE", sortOrder: 4 },
  { key: "NAGAD", nameBn: "নগদ", kind: "MOBILE", sortOrder: 5 },
] as const;

export async function ensureAccounts(db: DB): Promise<void> {
  for (const a of DEFAULT_ACCOUNTS) {
    await db
      .insert(accounts)
      .values({ key: a.key, nameBn: a.nameBn, kind: a.kind, sortOrder: a.sortOrder })
      .onConflictDoNothing({ target: accounts.key });
  }
}

export async function ensureOwnerUser(db: DB): Promise<void> {
  const name = (process.env.SEED_ADMIN_NAME || "Shariful").trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.warn("[seed] SEED_ADMIN_PASSWORD missing — owner user not created. Set it in .env and run `npm run db:seed`.");
    return;
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.name, name)).limit(1);
  if (existing.length > 0) return;
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, passwordHash, role: "OWNER", active: true });
  console.log(`[seed] Owner user created: ${name}`);
}

/**
 * Seed-এর ডিফল্ট ৩ জন স্টাফ। প্রত্যেকের নাম/পাসওয়ার্ড আলাদা env-এ রাখা যায়।
 * পুরোনো deployment-এর জন্য SEED_STAFF_PASSWORD shared fallback হিসেবেও কাজ করে।
 */
export const DEFAULT_STAFF_NAMES = ["Saiful", "Rahman", "Nirob"] as const;

export async function ensureStaffUsers(db: DB): Promise<void> {
  const sharedPassword = process.env.SEED_STAFF_PASSWORD;

  for (const [index, defaultName] of DEFAULT_STAFF_NAMES.entries()) {
    const slot = index + 1;
    const name = (process.env[`SEED_STAFF_${slot}_NAME`] || defaultName).trim();
    const password = process.env[`SEED_STAFF_${slot}_PASSWORD`] || sharedPassword;

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.name, name)).limit(1);
    if (existing.length > 0) continue;

    // পাসওয়ার্ড env-এ না থাকলেও ইউজার তৈরি হবে (random unusable password) —
    // যাতে টাস্ক assign-এর তালিকায় সবার নাম থাকে। লগইন দরকার হলে Owner টিম পেজ থেকে পাসওয়ার্ড সেট করবেন।
    const passwordHash = await bcrypt.hash(password ?? crypto.randomUUID(), 10);
    await db.insert(users).values({ name, passwordHash, role: "STAFF", active: true });
    if (password) {
      console.log(`[seed] Staff user created: ${name}`);
    } else {
      console.log(`[seed] Staff user created (নাম বাছাইয়ের জন্য, লগইন পাসওয়ার্ড ছাড়া): ${name}`);
    }
  }
}

/** Idempotently ensures the core accounts and configured login users exist. */
export async function seedIfEmpty(db: DB): Promise<void> {
  await ensureAccounts(db);
  await ensureOwnerUser(db);
  await ensureStaffUsers(db);
  if (process.env.SEED_DEMO === "1") {
    await seedDemoMasters(db);
  }
}

/** Optional sample masters so a fresh setup isn't empty (factories/cylinders/parties). */
export async function seedDemoMasters(db: DB): Promise<void> {
  let f1 = await db.query.factories.findFirst({ where: eq(factories.name, "সিটি প্রিন্টিং প্রেস") });
  if (!f1) {
    [f1] = await db
      .insert(factories)
      .values({ name: "সিটি প্রিন্টিং প্রেস", phone: "01711-000001", address: "চক বাজার, ঢাকা" })
      .returning();
  }
  let f2 = await db.query.factories.findFirst({ where: eq(factories.name, "মেঘনা প্যাকেজিং ইন্ডাস্ট্রিজ") });
  if (!f2) {
    [f2] = await db
      .insert(factories)
      .values({ name: "মেঘনা প্যাকেজিং ইন্ডাস্ট্রিজ", phone: "01711-000002", address: "গাজীপুর" })
      .returning();
  }
  const cyls: Array<{ name: string; factoryId: string }> = [
    { name: "ABC Chips", factoryId: f1.id },
    { name: "Potato Crackers", factoryId: f1.id },
    { name: "আলু চিপস ২০০গ্রাম", factoryId: f2.id },
  ];
  for (const c of cyls) {
    await db.insert(cylinders).values(c).onConflictDoNothing({ target: cylinders.name });
  }
  const parties = [
    { name: "ABC Packaging", phone: "01711-110011", address: "ঢাকা" },
    { name: "Dhaka Foods", phone: "01811-220022" },
    { name: "Rahman Trading", phone: "01911-330033" },
  ];
  for (const p of parties) {
    await db.insert(packagingParties).values(p).onConflictDoNothing({ target: packagingParties.name });
  }
  const anyCustomer = await db.select({ id: regularCustomers.id }).from(regularCustomers).limit(1);
  if (anyCustomer.length === 0) {
    await db.insert(regularCustomers).values([
      { name: "করিম উদ্দিন", phone: "01611-111111", address: "চক বাজার, ঢাকা" },
      { name: "সালমা বেগম", phone: "01622-222222", address: "লালবাগ, ঢাকা" },
    ]);
  }
  console.log("[seed] Demo masters ready (factories, cylinders, parties, customers).");
}
