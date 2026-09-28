import Link from "next/link";
import { listCollections, listCollectionLedger } from "@/server/services/collections";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PageHead, Tabs } from "@/components/page-head";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { CollectionActions, CashSaleButton } from "@/components/forms/collection-forms";
import { COLLECTION_STATUS_BN, collectionKindLabel } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

const kindTone: Record<string, "blue" | "amber" | "violet" | "green" | "teal" | "slate"> = {
  "কুরিয়ার কালেকশন": "blue",
  "কুরিয়ার কন্ডিশন": "violet",
  "পার্টি কালেকশন": "teal",
  "কাস্টমার কালেকশন": "amber",
  "নগদ বিক্রয়": "green",
};

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "pending";
  const [rows, accounts, ledger] = await Promise.all([
    tab === "pending" ? listCollections({ tab: "pending" }) : Promise.resolve([]),
    listAccountsWithBalances(),
    tab === "done" ? listCollectionLedger() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead
        title="কালেকশন"
        sub={tab === "pending" ? "কুরিয়ার থেকে টাকা আনা বাকি — পুরোনো আগে" : "কার থেকে কী কালেকশন — সব হিসাব"}
        right={
          <div className="flex gap-1.5">
            <CashSaleButton accounts={accounts} />
            <LinkButton href="/collections/new">+ কালেকশন</LinkButton>
          </div>
        }
      />
      <Tabs current={tab} tabs={[{ key: "pending", label: "আনা বাকি" }, { key: "done", label: "হিসাব" }]} />

      {tab === "pending" ? (
        rows.length === 0 ? (
          <Empty text="কোনো কালেকশন বাকি নেই">
            <LinkButton href="/collections/new" size="sm" variant="subtle">+ নতুন কালেকশন</LinkButton>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ collection: c, createdByName }) => (
              <li key={c.id}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">{c.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {createdByName} · {fmtDateShort(c.date)}
                      </p>
                    </div>
                    {c.status === "PENDING" ? (
                      <AgeChip from={c.createdAt} prefix="বাকি" />
                    ) : (
                      <Badge tone={c.status === "RECEIVED" ? "green" : "red"}>{COLLECTION_STATUS_BN[c.status]}</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-base font-extrabold text-slate-900">প্রত্যাশিত {bnMoney(c.expectedAmount)}</p>
                  </div>
                  {c.status === "PENDING" && (
                    <div className="mt-2.5">
                      <CollectionActions id={c.id} title={c.title} expectedAmount={c.expectedAmount} accounts={accounts} />
                    </div>
                  )}
                  {c.notes && <p className="mt-2 text-xs text-slate-500">📝 {c.notes}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : ledger.length === 0 ? (
        <Empty text="এখনও কোনো কালেকশন হিসাব নেই">
          <p className="text-xs text-slate-400">পেমেন্ট এন্ট্রির সময় «কালেকশনে এড হবে» টগল অন করলে এখানে আসবে</p>
        </Empty>
      ) : (
        <>
          <ul className="space-y-2">
            {ledger.map(({ payment: p, accountName, partyName, customerName, createdByName }) => {
              const kind = collectionKindLabel(p);
              const who = partyName ?? customerName ?? p.notes ?? "—";
              return (
                <li key={p.id} className={`rounded-2xl border p-3.5 shadow-sm ${p.voidedAt ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={kindTone[kind] ?? "slate"}>{kind}</Badge>
                        <Badge tone="slate">{accountName}</Badge>
                        {p.voidedAt && <Badge tone="red">বাতিল</Badge>}
                      </div>
                      <p className="mt-1 text-[13px] font-bold text-slate-800">{who}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {createdByName} · {fmtDateShort(p.date)}
                        {p.notes && (partyName || customerName) ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-extrabold ${p.voidedAt ? "text-slate-400 line-through" : "text-emerald-700"}`}>+{bnMoney(p.amount)}</p>
                      <Link href={`/payments/${p.id}`} className="text-[11px] font-semibold text-brand-700 hover:underline">
                        TXN-{bn(p.txnNo)}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-center text-xs text-slate-400">
            {bn(ledger.length)}টি এন্ট্রি · <Link href="/payments" className="font-semibold text-brand-700 hover:underline">সব পেমেন্ট দেখুন →</Link>
          </p>
        </>
      )}
    </div>
  );
}
