import { listCollections } from "@/server/services/collections";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PageHead, Tabs } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { CollectionActions } from "@/components/forms/collection-forms";
import { COLLECTION_STATUS_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort, fmtDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "pending";
  const [rows, accounts] = await Promise.all([listCollections({ tab }), listAccountsWithBalances()]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead
        title="কুরিয়ার কালেকশন"
        sub={tab === "pending" ? "কুরিয়ার থেকে টাকা আনা বাকি — পুরোনো আগে" : "রিসিভ হওয়া/বাতিল কালেকশন"}
        right={<LinkButton href="/collections/new">+ নতুন কালেকশন</LinkButton>}
      />
      <Tabs current={tab} tabs={[{ key: "pending", label: "আনা বাকি" }, { key: "done", label: "রিসিভ/বাতিল" }]} />

      {rows.length === 0 ? (
        <Empty text={tab === "pending" ? "কোনো কালেকশন বাকি নেই" : "কিছু নেই"}>
          {tab === "pending" && <LinkButton href="/collections/new" size="sm" variant="subtle">+ নতুন কালেকশন</LinkButton>}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ collection: c, createdByName, receivedByName, accountName }) => (
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
                  <p className="text-base font-extrabold text-slate-900">
                    প্রত্যাশিত {bnMoney(c.expectedAmount)}
                    {c.receivedAmount != null && (
                      <span className="ml-2 text-sm font-bold text-emerald-700">রিসিভ {bnMoney(c.receivedAmount)}</span>
                    )}
                  </p>
                </div>
                {c.status === "PENDING" && (
                  <div className="mt-2.5">
                    <CollectionActions id={c.id} title={c.title} expectedAmount={c.expectedAmount} accounts={accounts} />
                  </div>
                )}
                {c.status === "RECEIVED" && (
                  <p className="mt-2 text-xs text-slate-500">
                    {receivedByName} · {fmtDateTime(c.receivedAt)} · {accountName}
                  </p>
                )}
                {c.notes && <p className="mt-2 text-xs text-slate-500">📝 {c.notes}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
