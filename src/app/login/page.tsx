import { getDb, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { LoginForm } from "./login-form";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let names: string[] = [];
  try {
    const db = await getDb();
    const list = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.active, true));
    names = list.map((u) => u.name);
  } catch {
    names = [];
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-950 to-slate-950 p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.28)] ring-2 ring-white/25">
            <Image src="/icons/icon-192.png" alt="এনএস ট্রেডার্স" width={64} height={64} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">এনএস ট্রেডার্স</h1>
          <p className="mt-1 text-sm text-brand-100/80">ব্যবসা ব্যবস্থাপনা — শুধুমাত্র টিমের জন্য</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <LoginForm userNames={names} />
        </div>
        <p className="mt-4 text-center text-xs text-brand-100/60">প্রাইভেট সিস্টেম · Login ছাড়া কোনো তথ্য দেখা যাবে না</p>
      </div>
    </div>
  );
}
