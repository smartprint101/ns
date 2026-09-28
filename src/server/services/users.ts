import { z } from "zod";
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, type CurrentUser } from "./shared";

export async function listUsers() {
  const db = await getDb();
  return db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, active: schema.users.active, createdAt: schema.users.createdAt })
    .from(schema.users)
    .orderBy(asc(schema.users.createdAt));
}

export async function listActiveUsers() {
  const db = await getDb();
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.active, true))
    .orderBy(asc(schema.users.createdAt));
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, "নাম দিন (কমপক্ষে ২ অক্ষর)"),
  password: z.string().min(4, "পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে"),
  role: z.enum(["OWNER", "STAFF"]).default("STAFF"),
});

export async function createUser(actor: CurrentUser, input: { name: string; password: string; role: "OWNER" | "STAFF" }) {
  if (actor.role !== "OWNER") throw new BizError("শুধু Owner নতুন ইউজার যোগ করতে পারবেন");
  const data = createUserSchema.parse(input);
  const db = await getDb();
  const passwordHash = await bcrypt.hash(data.password, 10);
  const [row] = await db
    .insert(schema.users)
    .values({ name: data.name, passwordHash, role: data.role, active: true })
    .returning({ id: schema.users.id, name: schema.users.name });
  return row;
}

export async function setUserActive(actor: CurrentUser, userId: string, active: boolean) {
  if (actor.role !== "OWNER") throw new BizError("শুধু Owner ইউজার deactivate করতে পারবেন");
  if (userId === actor.id) throw new BizError("নিজেকে deactivate করা যাবে না");
  const db = await getDb();
  const [row] = await db.update(schema.users).set({ active }).where(eq(schema.users.id, userId)).returning({ id: schema.users.id });
  if (!row) throw new BizError("ইউজার পাওয়া যায়নি");
  return row;
}

export async function resetPassword(actor: CurrentUser, userId: string, newPassword: string) {
  if (actor.role !== "OWNER") throw new BizError("শুধু Owner পাসওয়ার্ড রিসেট করতে পারবেন");
  if (newPassword.length < 4) throw new BizError("পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে");
  const db = await getDb();
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
}

/** Any logged-in user may change their own password. */
export async function changeOwnPassword(actor: CurrentUser, oldPassword: string, newPassword: string) {
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, actor.id)).limit(1);
  if (!user) throw new BizError("ইউজার পাওয়া যায়নি");
  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) throw new BizError("পুরাতন পাসওয়ার্ড ঠিক নেই");
  if (newPassword.length < 4) throw new BizError("নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে");
  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(newPassword, 10) })
    .where(and_(eq(schema.users.id, actor.id)));
}

function and_(c: unknown) {
  return c as never;
}
