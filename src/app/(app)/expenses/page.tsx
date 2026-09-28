import Link from "next/link";
import { listExpenses } from "@/server/services/expenses";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PageHead, SearchBox } from "@/components/page-head";
import { Badge, Empty, LinkButton } from "@/components/ui";
import { VoidExpenseButton } from "@/components/forms/money-actions";
import { EXPENSE_CATEGORY_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; account?: string }> }) {
  const sp = await searchParams;
  const [rows, accounts] = await Promise.all([
    listExpenses({ q: sp.q, category: sp.category, accountId: sp.account }),
    listAccountsWithBalances(),
  ]);
  const total = rows.filter((r) => !r.expense.voidedAt).reduce((s, r) => s + r.expense.amount, 0);

  return (
    <div>
      <PageHead title="খরচ" sub={`${bn(rows.length)}টি এন্ট্রি · সচল মোট ${bnMoney(Math.round(total * 100) / 100)}`} right={<LinkButton href="/expenses/new">+ নতুন খরচ</LinkButton>} />

      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        <FilterChip href="/expenses" active={!sp.category} label="সব ক্যাটাগরি" />
        {Object.entries(EXPENSE_CATEGORY_BN).map(([k, v]) => (
          <FilterChip key={k} href={`/expenses?category=${k}`} active={sp.category === k} label={v} />
        ))}
      </div>
      <SearchBox placeholder="বিবরণ / পার্টি / ফ্যাক্টরি…" defaultValue={sp.q} hidden={sp.category ? { category: sp.category } : undefined} />

      {rows.length === 0 ? (
        <Empty text="কোনো খরচ পাওয়া যায়নি">
          <LinkButton href="/expenses/new" size="sm" variant="subtle">+ নতুন খরচ</LinkButton>
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ expense: e, account, party, factory, regularOrderNo, packagingOrderNo, taskTitle, createdByName }) => (
            <li key={e.id} className={`rounded-2xl border p-3.5 shadow-sm ${e.voidedAt ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="slate">{EXPENSE_CATEGORY_BN[e.category]}</Badge>
                    <Badge tone="teal">{account.nameBn}</Badge>
                    {e.voidedAt && <Badge tone="red">বাতিল</Badge>}
                  </div>
                  <p className={`mt-1 text-sm font-bold ${e.voidedAt ? "text-slate-400 line-through" : "text-slate-800"}`}>{e.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {createdByName} · {fmtDateShort(e.date)}
                    {party && ` · পার্টি: ${party.name}`}
                    {factory && ` · ফ্যাক্টরি: ${factory.name}`}
                    {packagingOrderNo != null && (
                      <>
                        {" · "}
                        <Link href={`/packaging/${e.packagingOrderId}`} className="font-bold text-brand-700">
                          PKG-{bn(packagingOrderNo)}
                        </Link>
                      </>
                    )}
                    {regularOrderNo != null && (
                      <>
                        {" · "}
                        <Link href={`/orders/${e.regularOrderId}`} className="font-bold text-brand-700">
                          #{bn(regularOrderNo)}
                        </Link>
                      </>
                    )}
                    {taskTitle && ` · টাস্ক: ${taskTitle}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-base font-extrabold ${e.voidedAt ? "text-slate-400 line-through" : "text-red-600"}`}>−{bnMoney(e.amount)}</p>
                  {!e.voidedAt && (
                    <div className="mt-1.5">
                      <VoidExpenseButton expenseId={e.id} amount={e.amount} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
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
