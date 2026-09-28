import Link from "next/link";
import { listTasks } from "@/server/services/tasks";
import { listActiveUsers } from "@/server/services/users";
import { listParties, listFactories } from "@/server/services/masters";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { listPackagingOrders } from "@/server/services/packaging-orders";
import { PageHead, Tabs } from "@/components/page-head";
import { Badge, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { TaskActions } from "@/components/forms/task-forms";
import { TASK_STATUS_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateTime, fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ tab?: string; user?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : sp.tab === "cancelled" ? "cancelled" : "pending";
  const status = tab === "done" ? "completed" : tab;
  const [rows, users, parties, factories, accounts, pkgActive] = await Promise.all([
    listTasks({ status, assignedToId: sp.user }),
    listActiveUsers(),
    listParties(),
    listFactories(),
    listAccountsWithBalances(),
    listPackagingOrders({ tab: "active" }),
  ]);
  const orderOptions = pkgActive.slice(0, 100).map((r) => ({
    kind: "packaging" as const,
    id: r.order.id,
    label: `PKG-${r.order.orderNo} · ${r.party.name}`,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead
        title="টাস্ক"
        sub={tab === "pending" ? "কালেকশন/খরচ হলে খাতায় এন্ট্রির টাস্ক অটো যোগ হবে — এন্ট্রি শেষে ওকে দিন" : undefined}
        right={<LinkButton href="/tasks/new">+ নতুন টাস্ক</LinkButton>}
      />
      <Tabs current={tab} tabs={[{ key: "pending", label: "বাকি আছে" }, { key: "done", label: "সম্পন্ন" }, { key: "cancelled", label: "বাতিল" }]} />

      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        <Link
          href={`/tasks?tab=${tab}`}
          className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold ${!sp.user ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}
        >
          সবার
        </Link>
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/tasks?tab=${tab}&user=${u.id}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold ${sp.user === u.id ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}
          >
            {u.name}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty text={tab === "pending" ? "কোনো টাস্ক বাকি নেই — দারুণ!" : "কিছু নেই"}>
          {tab === "pending" && <LinkButton href="/tasks/new" size="sm" variant="subtle">+ টাস্ক দিন</LinkButton>}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ task: t, assignedToName, createdByName, completedByName, expenseSum }) => (
            <li key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">
                    {assignedToName} — {t.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {createdByName} দিয়েছেন · {fmtDateShort(t.createdAt)}
                  </p>
                </div>
                {t.status === "PENDING" ? (
                  <AgeChip from={t.createdAt} prefix="পেন্ডিং" />
                ) : (
                  <Badge tone={t.status === "COMPLETED" ? "green" : "red"}>{TASK_STATUS_BN[t.status]}</Badge>
                )}
              </div>
              {t.description && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-100">{t.description}</p>}
              {t.status === "PENDING" ? (
                <div className="mt-3">
                  <TaskActions taskId={t.id} taskTitle={t.title} accounts={accounts} parties={parties} factories={factories} orderOptions={orderOptions} />
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {t.status === "COMPLETED" ? (
                    <>
                      ✓ {completedByName ?? "—"} সম্পন্ন করেছেন · {fmtDateTime(t.completedAt)}
                    </>
                  ) : (
                    <>বাতিল হয়েছে · {fmtDateTime(t.cancelledAt)}</>
                  )}
                  {t.completionNote && ` — ${t.completionNote}`}
                  {expenseSum > 0 && <span className="ml-1.5 font-bold text-red-600">খরচ {bnMoney(expenseSum)}</span>}
                </p>
              )}
              {t.status === "PENDING" && expenseSum > 0 && <p className="mt-2 text-xs font-bold text-red-600">এই টাস্কে খরচ: {bnMoney(expenseSum)}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">{bn(rows.length)}টি টাস্ক</p>
    </div>
  );
}
