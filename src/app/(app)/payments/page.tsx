import Link from "next/link";
import { listPayments } from "@/server/services/payments";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PageHead, SearchBox } from "@/components/page-head";
import { Badge, Empty, LinkButton } from "@/components/ui";
import { VoidPaymentButton } from "@/components/forms/money-actions";
import { PAYMENT_SOURCE_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string; account?: string }> }) {
  const sp = await searchParams;
  const [rows, accounts] = await Promise.all([listPayments({ q: sp.q, accountId: sp.account }), listAccountsWithBalances()]);

  return (
    <div>
      <PageHead title="পেমেন্ট" sub="সব টাকা-আসার এন্ট্রি (পেমেন্ট, কন্ডিশন, কুরিয়ার কালেকশন)" right={<LinkButton href="/payments/new">+ নতুন পেমেন্ট</LinkButton>} />

      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        <FilterChip href="/payments" active={!sp.account} label="সব মেথড" />
        {accounts.map((a) => (
          <FilterChip key={a.id} href={`/payments?account=${a.id}`} active={sp.account === a.id} label={a.nameBn} />
        ))}
      </div>
      <SearchBox placeholder="TXN নম্বর / পার্টি / কাস্টমার / নোট…" defaultValue={sp.q} hidden={sp.account ? { account: sp.account } : undefined} />

      {rows.length === 0 ? (
        <Empty text="কোনো পেমেন্ট পাওয়া যায়নি">
          <LinkButton href="/payments/new" size="sm" variant="subtle">+ নতুন পেমেন্ট</LinkButton>
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ payment: p, account, party, customer, createdByName, allocCount }) => (
            <li key={p.id} className={`rounded-2xl border p-3.5 shadow-sm ${p.voidedAt ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/payments/${p.id}`} className="text-sm font-extrabold text-slate-900 hover:text-brand-700">
                      TXN-{bn(p.txnNo)}
                    </Link>
                    <Badge tone="teal">{account.nameBn}</Badge>
                    {p.source !== "MANUAL" && <Badge tone="blue">{PAYMENT_SOURCE_BN[p.source]}</Badge>}
                    {p.isAdvance && <Badge tone="violet">অ্যাডভান্স</Badge>}
                    {p.voidedAt && <Badge tone="red">বাতিল</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] text-slate-600">
                    <span className="font-bold">{party?.name ?? customer?.name ?? "—"}</span>
                    {allocCount > 0 && <span className="text-slate-500"> · {bn(allocCount)}টি অর্ডারে বণ্টিত</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {createdByName} · {fmtDateShort(p.date)}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-base font-extrabold ${p.voidedAt ? "text-slate-400 line-through" : "text-emerald-700"}`}>+{bnMoney(p.amount)}</p>
                  {!p.voidedAt && (
                    <div className="mt-1.5">
                      <VoidPaymentButton paymentId={p.id} amount={p.amount} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">{bn(rows.length)}টি এন্ট্রি</p>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
        active ? "bg-brand-700 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
