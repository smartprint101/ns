import { SignJWT, jwtVerify } from "jose";

/** Edge-safe session helpers (jose only — no DB, no next/headers). */

export const SESSION_COOKIE = "ns_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 দিন
const THIRTY_DAYS = "30d";

export type SessionPayload = { userId: string; name: string; role: "OWNER" | "STAFF" };

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(THIRTY_DAYS)
    .sign(key());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.userId || !payload.name) return null;
    return {
      userId: String(payload.userId),
      name: String(payload.name),
      role: payload.role === "OWNER" ? "OWNER" : "STAFF",
    };
  } catch {
    return null;
  }
}
