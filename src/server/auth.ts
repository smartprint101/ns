import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySessionToken,
  IDENTITY_COOKIE,
  IDENTITY_MAX_AGE,
  signIdentity,
  verifyIdentityToken,
  type SessionPayload,
} from "./session";

export { SESSION_COOKIE, IDENTITY_COOKIE, signSession, verifySessionToken };
export type { SessionPayload };
export type CurrentUser = { id: string; name: string; role: "OWNER" | "STAFF" };

/** Read session from cookie (JWT only, no DB). */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

/**
 * লগইন অ্যাকাউন্ট + ডিভাইস আইডেন্টিটি মিলিয়ে "এখন কে কাজ করছে" বের করে।
 * - লগইন যে অ্যাকাউন্ট দিয়েই হোক, ডিভাইসে নাম বাছাই করা থাকলে সেই ব্যক্তিই effective user।
 * - STAFF লগইন থেকে কখনোই OWNER ক্ষমতা পাওয়া যাবে না (role escalation বন্ধ)।
 * - identified=false মানে এই ডিভাইসে এখনো নাম বাছাই হয়নি → পপআপ দেখাতে হবে।
 */
export const resolveCurrentUser = cache(
  async (): Promise<{ user: CurrentUser; identified: boolean } | null> => {
    const session = await getSession();
    if (!session) return null;
    const db = await getDb();
    const loginUser = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
    if (!loginUser || !loginUser.active) return null;

    const store = await cookies();
    const token = store.get(IDENTITY_COOKIE)?.value;
    const identity = token ? await verifyIdentityToken(token) : null;

    if (identity) {
      if (identity.userId === loginUser.id) {
        return { user: { id: loginUser.id, name: loginUser.name, role: loginUser.role }, identified: true };
      }
      const person = await db.query.users.findFirst({ where: eq(schema.users.id, identity.userId) });
      if (person && person.active) {
        // লগইন STAFF হলে identity দিয়ে OWNER হওয়া যাবে না।
        const role = loginUser.role === "OWNER" ? person.role : "STAFF";
        return { user: { id: person.id, name: person.name, role }, identified: true };
      }
      // identity user মুছে গেছে/বন্ধ — আবার নাম বাছাই করতে হবে।
    }
    return { user: { id: loginUser.id, name: loginUser.name, role: loginUser.role }, identified: false };
  }
);

/** Session + DB check that the user still exists and is active. Redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const resolved = await resolveCurrentUser();
  if (!resolved) redirect("/login");
  return resolved.user;
}

/** Layout-এর জন্য: effective user + এই ডিভাইসে নাম বাছাই হয়েছে কি না। */
export async function requireUserWithIdentity(): Promise<{ user: CurrentUser; identified: boolean }> {
  const resolved = await resolveCurrentUser();
  if (!resolved) redirect("/login");
  return resolved;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/");
  return user;
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** এই ডিভাইসে "আমি কে" — নাম বাছাইয়ের কুকি সেট করে (১ বছর থাকে)। */
export async function setIdentityCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(IDENTITY_COOKIE, await signIdentity({ userId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: IDENTITY_MAX_AGE,
    path: "/",
  });
}

export async function clearIdentityCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IDENTITY_COOKIE);
}
