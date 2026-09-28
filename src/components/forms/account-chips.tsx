"use client";

import { cn } from "@/lib/utils";

const kindHint: Record<string, string> = { CASH: "ক্যাশ", BANK: "ব্যাংক", MOBILE: "মোবাইল" };

/** Big tappable account (payment method) chips — Cash / DBBL / BRAC / bKash / Nagad. */
export function AccountChips({
  accounts,
  value,
  onChange,
  showBalance = true,
}: {
  accounts: { id: string; key: string; nameBn: string; kind: string; balance: number }[];
  value: string;
  onChange: (id: string) => void;
  showBalance?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          className={cn(
            "flex min-h-[56px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition",
            value === a.id
              ? "border-brand-700 bg-brand-700 text-white shadow-sm"
              : "border-slate-300 bg-white text-slate-800 hover:border-brand-400"
          )}
        >
          <span className="text-sm font-bold leading-tight">{a.nameBn}</span>
          {showBalance && (
            <span className={cn("mt-0.5 text-[11px]", value === a.id ? "text-white/80" : "text-slate-400")}>
              {kindHint[a.kind] ?? a.kind} · ৳{a.balance.toLocaleString("en-IN")}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
