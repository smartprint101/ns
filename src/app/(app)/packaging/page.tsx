import Link from "next/link";
import { listPackagingOrders, type PackagingTab } from "@/server/services/packaging-orders";
import { PageHead, Tabs, SearchBox } from "@/components/page-head";
import { Badge, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { PACKAGING_STAGE_BN, STATUS_BN, WORK_TYPE_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort, daysSince } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PackagingPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = (["active", "completed", "cancelled"].includes(sp.tab ?? "") ? sp.tab : "active") as PackagingTab;
  const rows = await listPackagingOrders({ tab, q: sp.q });

  return (
    <div>
      <PageHead
        title="প্যাকেজিং অর্ডার"
        sub={tab === "active" ? "সবচেয়ে পুরোনো পেন্ডিং অর্ডার সবার উপরে" : undefined}
        right={<LinkButton href="/packaging/new">+ নতুন অর্ডার</LinkButton>}
      />
      <Tabs
        current={tab}
        tabs={[
          { key: "active", label: "চলমান" },
          { key: "completed", label: "সম্পন্ন" },
          { key: "cancelled", label: "বাতিল" },
        ]}
      />
      <SearchBox placeholder="PKG নম্বর / পার্টির নাম…" defaultValue={sp.q} hidden={{ tab }} />

      {rows.length === 0 ? (
        <Empty text={sp.q ? "এই খোঁজে কিছু পাওয়া যায়নি" : "কিছু নেই"}>
          {tab === "active" && <LinkButton href="/packaging/new" size="sm" variant="subtle">+ নতুন প্যাকেজিং অর্ডার</LinkButton>}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ order, party, factory, cylinder, paid }) => {
            const due = Math.round((order.totalBill - paid) * 100) / 100;
            const longPending = tab === "active" && daysSince(order.createdAt) >= 10;
            return (
              <li key={order.id}>
                <Link
                  href={`/packaging/${order.id}`}
                  className={`block rounded-2xl border bg-white p-3.5 shadow-sm transition hover:border-brand-300 active:scale-[0.995] ${
                    longPending ? "border-red-300 ring-1 ring-red-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">
                        PKG-{bn(order.orderNo)} · {party.name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-slate-600">
                        {WORK_TYPE_BN[order.workType]} · {bn(order.finalKg)} কেজি
                        {order.extraKg > 0 && <span className="text-xs text-slate-400"> (মূল {bn(order.totalKg)} + অতিরিক্ত {bn(order.extraKg)})</span>}
                      </p>
                    </div>
                    {tab === "active" && <AgeChip from={order.createdAt} prefix="ধরে চলছে" />}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                    <MiniStat label="বিল" value={bnMoney(order.totalBill)} />
                    <MiniStat label="জমা" value={bnMoney(paid)} green={paid > 0} />
                    <MiniStat label="বাকি" value={bnMoney(Math.max(due, 0))} red={due > 0} />
                    <MiniStat label="কেজি" value={`${bn(order.finalKg)}কেজি`} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={order.stage === "DELIVERED" ? "green" : order.stage === "PRODUCTION" || order.stage === "PRODUCTION_DONE" ? "violet" : "blue"}>
                        {PACKAGING_STAGE_BN[order.stage]}
                      </Badge>
                      {order.status !== "ACTIVE" && <Badge tone={order.status === "COMPLETED" ? "green" : "red"}>{STATUS_BN[order.status]}</Badge>}
                      {longPending && <Badge tone="red">১০+ দিন পেন্ডিং</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold">{factory.name}</span>
                      {cylinder && <span> · {cylinder.name}</span>} · {fmtDateShort(order.createdAt)}
                    </p>
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

function MiniStat({ label, value, red, green }: { label: string; value: string; red?: boolean; green?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1.5 py-1.5 ring-1 ring-inset ring-slate-100">
      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
      <p className={`truncate text-xs font-extrabold ${red ? "text-red-600" : green ? "text-emerald-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
