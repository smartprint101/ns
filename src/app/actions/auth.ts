"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/server/db";
import { setSessionCookie, clearSessionCookie } from "@/server/auth";

const loginSchema = z.object({
  name: z.string().trim().min(1, "নাম দিন"),
  password: z.string().min(1, "পাসওয়ার্ড দিন"),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "নাম ও পাসওয়ার্ড দিন" };

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(trim(${schema.users.name})) = lower(trim(${parsed.data.name}))`)
    .limit(1);

  if (!user || !user.active) return { error: "নাম অথবা পাসওয়ার্ড ঠিক নেই" };

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "নাম অথবা পাসওয়ার্ড ঠিক নেই" };

  await setSessionCookie({ userId: user.id, name: user.name, role: user.role });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
