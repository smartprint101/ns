import { getDashboardData } from "@/server/services/dashboard";
import { requireUser } from "@/server/auth";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDate } from "@/lib/dates";
import { AgeChip } from "@/components/age-chip";
import { Badge, Card, CardTitle, Stat, Empty } from "@/components/ui";
import { Icon } from "@/components/app-shell";
import { REGULAR_STAGE_BN, PACKAGING_STAGE_BN, EXPENSE_CATEGORY_BN, WORK_TYPE_BN } from "@/lib/labels";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboardData();

  const quickActions = [
    { href: "/orders/new", label: "রেগুলার অর্ডার", icon: "orders" },
    { href: "/packaging/new", label: "প্যাকেজিং অর্ডার", icon: "package" },
    { href: "/payments/new", label: "পেমেন্ট", icon: "money" },
    { href: "/expenses/new", label: "খরচ", icon: "expense" },
    { href: "/tasks/new", label: "টাস্ক", icon: "tasks" },
    { href: "/collections/new", label: "কালেকশন", icon: "collection" },
  ];

  const workStats = [
    { label: "নতুন রেগুলার অর্ডার", value: d.work.newOrders, href: "/orders", tone: d.work.newOrders > 0 ? ("blue" as const) : ("slate" as const) },
    { label: "চলমান রেগুলার অর্ডার", value: d.work.activeRegular, href: "/orders", tone: "slate" as const },
    { label: "কুরিয়ার পেন্ডিং", value: d.work.courierPending, href: "/orders", tone: d.work.courierPending > 0 ? ("amber" as const) : ("slate" as const) },
    { label: "কন্ডিশন পেন্ডিং", value: d.work.conditionPending, href: "/conditions", tone: d.work.conditionPending > 0 ? ("red" as const) : ("slate" as const) },
    { label: "চলমান প্যাকেজিং", value: d.work.packagingActive, href: "/packaging", tone: "slate" as const },
    { label: "পুরোনো প্যাকেজিং (১০+ দিন)", value: d.work.packagingLong, href: "/packaging", tone: d.work.packagingLong > 0 ? ("red" as const) : ("slate" as const) },
    { label: "পেন্ডিং টাস্ক", value: d.work.pendingTasks, href: "/tasks", tone: d.work.pendingTasks > 0 ? ("amber" as const) : ("slate" as const) },
  ];

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">ড্যাশবোর্ড</h1>
          <p className="text-sm text-slate-500">{fmtDate(new Date())} · {user.name}</p>
        </div>
        <Link href="/search" className="hidden text-sm font-semibold text-brand-700 hover:underline lg:block">
          সার্চ করুন →
        </Link>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {quickActions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-brand-600/20 bg-brand-700 px-2 py-3.5 text-center text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.98]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15">
              <Icon name="plus" className="h-4 w-4" />
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Financial snapshot */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold text-slate-500">আর্থিক সারসংক্ষেপ</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat
            label="আজকের কালেকশন"
            value={bnMoney(d.money.todayCollection)}
            sub={`${bn(d.money.todayCollectionCount)}টি এন্ট্রি`}
            tone="green"
            href="/payments"
          />
          <Stat
            label="আজকের খরচ"
            value={bnMoney(d.money.todayExpense)}
            sub={
              Object.keys(d.money.expenseByCategory).length > 0
                ? Object.entries(d.money.expenseByCategory)
                    .map(([k, v]) => `${EXPENSE_CATEGORY_BN[k] ?? k} ${bnMoney(v)}`)
                    .join(" · ")
                : `${bn(d.money.todayExpenseCount)}টি এন্ট্রি`
            }
            tone="red"
            href="/expenses"
          />
          <Stat
            label="কুরিয়ার কালেকশন বাকি"
            value={bnMoney(d.work.collectionsPendingSum)}
            sub={`${bn(d.work.collectionsPendingCount)}টি কালেকশন আনা বাকি`}
            tone={d.work.collectionsPendingCount > 0 ? "amber" : "slate"}
            href="/collections"
          />
          {d.money.accounts.map((a) => (
            <Stat key={a.id} label={a.nameBn} value={bnMoney(a.balance)} sub={a.kind === "CASH" ? "ক্যাশ" : a.kind === "BANK" ? "ব্যাংক" : "মোবাইল ব্যাংকিং"} tone={a.balance < 0 ? "red" : "slate"} href="/accounts" />
          ))}
        </div>
      </section>

      {/* Active work */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold text-slate-500">চলমান কাজ</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {workStats.map((s) => (
            <Link key={s.label} href={s.href} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:border-brand-300">
              <p className={`text-2xl font-extrabold ${s.tone === "red" ? "text-red-600" : s.tone === "amber" ? "text-amber-600" : s.tone === "blue" ? "text-sky-600" : "text-slate-900"}`}>
                {bn(s.value)}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500">{s.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Oldest pending first */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle right={<Link href="/orders" className="text-xs font-bold text-brand-700">সব দেখুন →</Link>}>
            পুরোনো রেগুলার অর্ডার
          </CardTitle>
          {d.lists.oldestRegular.length === 0 ? (
            <Empty text="কোনো চলমান অর্ডার নেই" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.lists.oldestRegular.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        #{bn(o.orderNo)} · {o.customerName}
                      </p>
                      <p className="text-xs text-slate-500">{REGULAR_STAGE_BN[o.stage]} · {bnMoney(o.totalAmount)}</p>
                    </div>
                    <AgeChip from={o.createdAt} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle right={<Link href="/packaging" className="text-xs font-bold text-brand-700">সব দেখুন →</Link>}>
            পুরোনো প্যাকেজিং অর্ডার
          </CardTitle>
          {d.lists.oldestPackaging.length === 0 ? (
            <Empty text="কোনো চলমান প্যাকেজিং অর্ডার নেই" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.lists.oldestPackaging.map((o) => (
                <li key={o.id}>
                  <Link href={`/packaging/${o.id}`} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        PKG-{bn(o.orderNo)} · {o.partyName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {WORK_TYPE_BN[o.workType]} · {PACKAGING_STAGE_BN[o.stage]} · {o.factoryName}
                      </p>
                    </div>
                    <AgeChip from={o.createdAt} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle right={<Link href="/tasks" className="text-xs font-bold text-brand-700">সব দেখুন →</Link>}>
            পেন্ডিং টাস্ক
          </CardTitle>
          {d.lists.oldestTasks.length === 0 ? (
            <Empty text="কোনো টাস্ক বাকি নেই" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.lists.oldestTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.assignedToName}</p>
                  </div>
                  <AgeChip from={t.createdAt} prefix="পেন্ডিং" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent updates: who did what */}
      <Card>
        <CardTitle>সাম্প্রতিক আপডেট</CardTitle>
        {d.lists.recentEvents.length === 0 ? (
          <Empty text="এখনও কোনো কাজ হয়নি" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.lists.recentEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 py-2">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-800">
                  {(e.actorName ?? "—").slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-slate-700">
                    <span className="font-bold">{e.actorName ?? "সিস্টেম"}</span>: {e.detail ?? e.action}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(e.createdAt).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <Badge tone="slate" className="mt-0.5">
                  {e.action}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
