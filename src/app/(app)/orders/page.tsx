import Link from "next/link";
import { listRegularOrders, type RegularTab } from "@/server/services/regular-orders";
import { PageHead, Tabs, SearchBox } from "@/components/page-head";
import { Badge, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { REGULAR_STAGE_BN, STATUS_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

const stageTone: Record<string, "blue" | "amber" | "violet" | "red" | "green"> = {
  PLACED: "blue",
  READY: "violet",
  COURIER_GIVEN: "amber",
  CONDITION_PENDING: "red",
  COMPLETED: "green",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = (["active", "completed", "cancelled"].includes(sp.tab ?? "") ? sp.tab : "active") as RegularTab;
  const rows = await listRegularOrders({ tab, q: sp.q });

  return (
    <div>
      <PageHead
        title={tab === "active" ? "পেন্ডিং রেগুলার অর্ডার" : "রেগুলার অর্ডার"}
        sub={tab === "active" ? "পুরোনো পেন্ডিং সবার উপরে" : undefined}
        right={<LinkButton href="/orders/new">+ নতুন অর্ডার</LinkButton>}
      />
      <Tabs
        current={tab}
        tabs={[
          { key: "active", label: "পেন্ডিং" },
          { key: "completed", label: "হিস্ট্রি" },
          { key: "cancelled", label: "বাতিল" },
        ]}
      />
      <SearchBox placeholder="অর্ডার নম্বর / কাস্টমার / ফোন…" defaultValue={sp.q} hidden={{ tab }} />

      {rows.length === 0 ? (
        <Empty text={sp.q ? "এই খোঁজে কিছু পাওয়া যায়নি" : tab === "active" ? "কোনো পেন্ডিং অর্ডার নেই" : "কিছু নেই"}>
          {tab === "active" && <LinkButton href="/orders/new" size="sm" variant="subtle">+ নতুন অর্ডার দিন</LinkButton>}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ order, customer, paid }) => {
            const due = Math.round((order.totalAmount - paid) * 100) / 100;
            const stageLabel =
              order.stage === "COURIER_GIVEN" && due > 0 && order.status === "ACTIVE" ? "বকেয়া" : REGULAR_STAGE_BN[order.stage];
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-brand-300 active:scale-[0.995]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">
                        #{bn(order.orderNo)} · {customer.name}
                        {order.hasCondition && tab === "active" && <span className="ml-1.5 text-xs font-bold text-amber-600">কন্ডিশন</span>}
                      </p>
                      {customer.phone && <p className="mt-0.5 text-[13px] text-slate-500">{customer.phone}</p>}
                    </div>
                    {tab === "active" && <AgeChip from={order.createdAt} />}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={stageTone[order.stage] ?? "slate"}>{stageLabel}</Badge>
                      {order.status !== "ACTIVE" && <Badge tone={order.status === "COMPLETED" ? "green" : "red"}>{STATUS_BN[order.status]}</Badge>}
                      {paid > 0 && <Badge tone="green">জমা {bnMoney(paid)}</Badge>}
                      {due > 0 && tab === "active" && <Badge tone="red">বকেয়া {bnMoney(due)}</Badge>}
                      {paid > 0 && tab === "active" && due <= 0 && <Badge tone="green">পরিশোধিত</Badge>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">{bnMoney(order.totalAmount)}</p>
                      <p className="text-[11px] text-slate-400">{fmtDateShort(order.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">{bn(rows.length)}টি অর্ডার</p>
    </div>
  );
}
