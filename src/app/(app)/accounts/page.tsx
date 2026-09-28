import Link from "next/link";
import { listAccountsWithBalances, listAccountTransactions } from "@/server/services/accounts";
import { requireUser } from "@/server/auth";
import { PageHead } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty } from "@/components/ui";
import { OwnerAccountButtons } from "@/components/forms/accounts-client";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TXN_KIND_BN: Record<string, string> = {
  PAYMENT_IN: "পেমেন্ট এসেছে",
  PAYMENT_REVERSAL: "পেমেন্ট বাতিল",
  EXPENSE_OUT: "খরচ",
  EXPENSE_REVERSAL: "খরচ বাতিল",
  ADJUSTMENT: "অ্যাজাস্টমেন্ট",
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const accounts = await listAccountsWithBalances();
  const selected = accounts.find((a) => a.id === sp.a) ?? accounts[0];
  const transactions = selected ? await listAccountTransactions(selected.id) : [];
  const totalAll = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-4">
      <PageHead title="ক্যাশ / ব্যাংক / মোবাইল" sub={`সব মিলিয়ে মোট ${bnMoney(Math.round(totalAll * 100) / 100)} — ব্যালান্স হিসাব হয় লেনদেন থেকে`} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/accounts?a=${a.id}`}
            className={cn(
              "rounded-2xl border p-3.5 shadow-sm transition",
              selected?.id === a.id ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white hover:border-brand-300"
            )}
          >
            <p className={cn("text-xs font-semibold", selected?.id === a.id ? "text-white/70" : "text-slate-400")}>
              {a.kind === "CASH" ? "ক্যাশ" : a.kind === "BANK" ? "ব্যাংক" : "মোবাইল ব্যাংকিং"}
            </p>
            <p className={cn("mt-1 text-sm font-extrabold leading-tight", selected?.id === a.id ? "text-white" : "text-slate-800")}>{a.nameBn}</p>
            <p className={cn("mt-1.5 text-lg font-extrabold", selected?.id === a.id ? "text-white" : a.balance < 0 ? "text-red-600" : "text-slate-900")}>
              {bnMoney(a.balance)}
            </p>
            <p className={cn("text-[10px]", selected?.id === a.id ? "text-white/60" : "text-slate-400")}>প্রারম্ভিক {bnMoney(a.openingBalance)}</p>
          </Link>
        ))}
      </div>

      {user.role === "OWNER" && (
        <Card>
          <CardTitle>Owner টুলস</CardTitle>
          <OwnerAccountButtons accounts={accounts.map((a) => ({ id: a.id, nameBn: a.nameBn }))} />
        </Card>
      )}

      {selected && (
        <Card>
          <CardTitle right={<Badge tone="teal">{selected.nameBn}</Badge>}>সাম্প্রতিক লেনদেন</CardTitle>
          {transactions.length === 0 ? (
            <Empty text="কোনো লেনদেন নেই" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{TXN_KIND_BN[t.kind] ?? t.kind}</p>
                    <p className="truncate text-xs text-slate-500">
                      {t.note ?? "—"} · {fmtDateShort(t.date)}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm font-extrabold", t.amount >= 0 ? "text-emerald-700" : "text-red-600")}>
                    {t.amount >= 0 ? "+" : ""}
                    {bnMoney(t.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-right text-xs text-slate-400">সর্বশেষ {bn(transactions.length)}টি</p>
        </Card>
      )}
    </div>
  );
}
