import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySessionToken, type SessionPayload } from "./session";

export { SESSION_COOKIE, signSession, verifySessionToken };
export type { SessionPayload };
export type CurrentUser = { id: string; name: string; role: "OWNER" | "STAFF" };

/** Read session from cookie (JWT only, no DB). */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

/** Session + DB check that the user still exists and is active. Redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user || !user.active) {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    redirect("/login");
  }
  return { id: user.id, name: user.name, role: user.role };
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
