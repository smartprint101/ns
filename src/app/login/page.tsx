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
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-900 to-brand-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl shadow-lg ring-2 ring-white/20">
            <Image src="/icons/icon-192.png" alt="এনএস ট্রেডার্স" width={64} height={64} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">এনএস ট্রেডার্স</h1>
          <p className="mt-1 text-sm text-brand-100/80">ব্যবসা ব্যবস্থাপনা — শুধুমাত্র টিমের জন্য</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-2xl">
          <LoginForm userNames={names} />
        </div>
        <p className="mt-4 text-center text-xs text-brand-100/60">প্রাইভেট সিস্টেম · Login ছাড়া কোনো তথ্য দেখা যাবে না</p>
      </div>
    </div>
  );
}
