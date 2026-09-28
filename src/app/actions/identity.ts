"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { getSession, setIdentityCookie } from "@/server/auth";

export type IdentityResult = { ok: true; name: string } | { ok: false; error: string };

const pickSchema = z.object({ userId: z.string().min(1) });
const newNameSchema = z.object({ name: z.string().trim().min(2, "নাম দিন (কমপক্ষে ২ অক্ষর)").max(60) });

/** তালিকা থেকে নিজের নাম বাছাই — এই ডিভাইসে সেই নামেই সব কাজ রেকর্ড হবে। */
export async function chooseIdentityAction(input: { userId: string }): Promise<IdentityResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "আগে লগইন করুন" };

  const parsed = pickSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "নাম বাছাই করুন" };

  const db = await getDb();
  const [person] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.id, parsed.data.userId), eq(schema.users.active, true)))
    .limit(1);
  if (!person) return { ok: false, error: "ইউজার পাওয়া যায়নি" };

  await setIdentityCookie(person.id);
  revalidatePath("/", "layout");
  return { ok: true, name: person.name };
}

/**
 * তালিকায় নাম না থাকলে নতুন নাম লিখে প্রবেশ — টিমে নতুন সদস্য তৈরি হয়ে যাবে।
 * (লগইন পাসওয়ার্ড থাকবে না; দরকার হলে Owner টিম পেজ থেকে পাসওয়ার্ড সেট করতে পারবেন।)
 */
export async function enterWithNewNameAction(input: { name: string }): Promise<IdentityResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "আগে লগইন করুন" };

  const parsed = newNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "নাম দিন" };
  const name = parsed.data.name;

  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.users.id, name: schema.users.name, active: schema.users.active })
    .from(schema.users)
    .where(sql`lower(trim(${schema.users.name})) = lower(trim(${name}))`)
    .limit(1);

  let person: { id: string; name: string };
  if (existing) {
    if (!existing.active) return { ok: false, error: "এই নামের ইউজার বন্ধ করা আছে — Owner-কে বলুন চালু করতে" };
    person = existing;
  } else {
    // লগইনের জন্য নয় — শুধু পরিচয়ের জন্য, তাই random unusable password।
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
    const [created] = await db
      .insert(schema.users)
      .values({ name, passwordHash, role: "STAFF", active: true })
      .returning({ id: schema.users.id, name: schema.users.name });
    person = created;
  }

  await setIdentityCookie(person.id);
  revalidatePath("/", "layout");
  return { ok: true, name: person.name };
}
