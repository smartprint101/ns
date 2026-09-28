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
    {
      href: "/orders/new",
      label: "রেগুলার অর্ডার",
      icon: "orders",
      card: "border-sky-200 bg-sky-50/80 text-sky-950 hover:border-sky-300 hover:bg-sky-100/70",
      iconStyle: "bg-sky-600 text-white",
    },
    {
      href: "/packaging/new",
      label: "প্যাকেজিং অর্ডার",
      icon: "package",
      card: "border-violet-200 bg-violet-50/80 text-violet-950 hover:border-violet-300 hover:bg-violet-100/70",
      iconStyle: "bg-violet-600 text-white",
    },
    {
      href: "/payments/new",
      label: "পেমেন্ট",
      icon: "money",
      card: "border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100/70",
      iconStyle: "bg-emerald-600 text-white",
    },
    {
      href: "/expenses/new",
      label: "খরচ",
      icon: "expense",
      card: "border-rose-200 bg-rose-50/80 text-rose-950 hover:border-rose-300 hover:bg-rose-100/70",
      iconStyle: "bg-rose-600 text-white",
    },
    {
      href: "/tasks/new",
      label: "টাস্ক",
      icon: "tasks",
      card: "border-amber-200 bg-amber-50/80 text-amber-950 hover:border-amber-300 hover:bg-amber-100/70",
      iconStyle: "bg-amber-500 text-amber-950",
    },
    {
      href: "/collections/new",
      label: "কালেকশন",
      icon: "collection",
      card: "border-cyan-200 bg-cyan-50/80 text-cyan-950 hover:border-cyan-300 hover:bg-cyan-100/70",
      iconStyle: "bg-cyan-600 text-white",
    },
  ];

  const workStats = [
    { label: "স্লিপ করা বাকি", value: d.work.newOrders, href: "/tasks", tone: d.work.newOrders > 0 ? ("blue" as const) : ("slate" as const) },
    { label: "পেন্ডিং রেগুলার অর্ডার", value: d.work.activeRegular, href: "/orders", tone: "slate" as const },
    { label: "কুরিয়ারে পাঠানো বাকি", value: d.work.courierPending, href: "/orders", tone: d.work.courierPending > 0 ? ("amber" as const) : ("slate" as const) },
    { label: "কুরিয়ার কন্ডিশন বকেয়া", value: d.work.conditionPending, href: "/dues", tone: d.work.conditionPending > 0 ? ("red" as const) : ("slate" as const) },
    { label: "পেন্ডিং প্যাকেজিং", value: d.work.packagingActive, href: "/packaging", tone: "slate" as const },
    { label: "পুরোনো প্যাকেজিং (১০+ দিন)", value: d.work.packagingLong, href: "/packaging", tone: d.work.packagingLong > 0 ? ("red" as const) : ("slate" as const) },
    { label: "পেন্ডিং টাস্ক", value: d.work.pendingTasks, href: "/tasks", tone: d.work.pendingTasks > 0 ? ("amber" as const) : ("slate" as const) },
  ];

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-4 py-5 text-white shadow-[0_14px_36px_rgba(6,38,30,0.18)] sm:px-5">
        <div className="pointer-events-none absolute -right-10 -top-20 h-52 w-52 rounded-full bg-brand-300/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-1/3 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold text-brand-200">আজকের ওভারভিউ</p>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">ড্যাশবোর্ড</h1>
            <p className="mt-1 text-sm font-medium text-brand-100/75">{fmtDate(new Date())} · {user.name}</p>
          </div>
          <Link
            href="/search"
            className="hidden rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15 lg:block"
          >
            সার্চ করুন →
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-extrabold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> দ্রুত কাজ
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-[13px] font-extrabold shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${a.card}`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-xl shadow-sm transition group-hover:scale-105 ${a.iconStyle}`}>
                <Icon name={a.icon} className="h-[18px] w-[18px]" />
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Financial snapshot */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-extrabold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> আর্থিক সারসংক্ষেপ
        </h2>
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
        <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-extrabold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> চলমান কাজ
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {workStats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={`rounded-2xl border p-3 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                s.tone === "red"
                  ? "border-rose-200 bg-rose-50/75"
                  : s.tone === "amber"
                    ? "border-amber-200 bg-amber-50/75"
                    : s.tone === "blue"
                      ? "border-sky-200 bg-sky-50/75"
                      : "border-slate-200 bg-white hover:border-brand-300"
              }`}
            >
              <p className={`text-2xl font-extrabold ${s.tone === "red" ? "text-rose-700" : s.tone === "amber" ? "text-amber-700" : s.tone === "blue" ? "text-sky-700" : "text-slate-900"}`}>
                {bn(s.value)}
              </p>
              <p className="mt-0.5 text-[11px] font-bold leading-tight text-slate-600">{s.label}</p>
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
