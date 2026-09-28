import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackagingOrder } from "@/server/services/packaging-orders";
import { listFactories, listCylinders } from "@/server/services/masters";
import { PageHead } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { AdvanceStageButton, CancelOrderButton, EditPackagingOrderButton } from "@/components/forms/order-actions";
import { PACKAGING_STAGE_BN, STATUS_BN, WORK_TYPE_BN, EXPENSE_CATEGORY_BN, PACKAGING_FLOWS, nextPackagingStage } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDate, fmtDateTime, fmtDateShort } from "@/lib/dates";
import { VoidPaymentButton, VoidExpenseButton } from "@/components/forms/money-actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PackagingOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, factories, cylinders] = await Promise.all([getPackagingOrder(id), listFactories(), listCylinders()]);
  if (!data) notFound();
  const { order, paid, advance, payments, expenses, events } = data;
  const due = Math.round((order.totalBill - paid) * 100) / 100;
  const flow = PACKAGING_FLOWS[order.workType] ?? [];
  const currentIdx = flow.indexOf(order.stage);
  const next = order.status === "ACTIVE" ? nextPackagingStage(order) : null;
  const nextLabel =
    next && order.stage !== "PLACED"
      ? `→ ${PACKAGING_STAGE_BN[next]}`
      : next === "ADVANCE"
        ? null // advance happens via payment
        : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHead
        title={`PKG-${bn(order.orderNo)}`}
        sub={`${fmtDate(order.createdAt)} · ${order.createdBy.name} তৈরি করেছেন`}
        right={<Badge tone={order.status === "COMPLETED" ? "green" : order.status === "CANCELLED" ? "red" : "blue"}>{STATUS_BN[order.status]}</Badge>}
      />

      {/* Top summary */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/parties/${order.partyId}`} className="text-lg font-extrabold text-slate-900 hover:text-brand-700">
              {order.party.name}
            </Link>
            <p className="text-sm text-slate-500">
              {WORK_TYPE_BN[order.workType]} · {order.party.phone ?? ""}
            </p>
          </div>
          {order.status === "ACTIVE" && <AgeChip from={order.createdAt} prefix="দিন ধরে চলছে" />}
        </div>

        {/* Stage flow — only stages relevant to this work type are shown */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-slate-400">কাজের ধাপ</p>
          <div className="flex flex-wrap gap-1.5">
            {flow.map((stage, i) => {
              const done = order.status === "COMPLETED" || i < currentIdx;
              const current = i === currentIdx && order.status === "ACTIVE";
              return (
                <span
                  key={stage}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
                    done
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : current
                        ? "bg-brand-700 text-white ring-brand-700"
                        : "bg-slate-50 text-slate-400 ring-slate-200"
                  )}
                >
                  {done ? "✓ " : ""}
                  {PACKAGING_STAGE_BN[stage]}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-3">
          <Info label="মোট কেজি" value={`${bn(order.totalKg)} কেজি`} />
          <Info label="এক্সট্রা কেজি" value={`${bn(order.extraKg)} কেজি`} highlight={order.extraKg > 0} />
          <Info label="ফাইনাল কেজি" value={`${bn(order.finalKg)} কেজি`} />
          <Info label="ফ্যাক্টরি" value={order.factory.name} />
          <Info label="সিলিন্ডার" value={order.cylinder ? `${order.cylinder.name} (${order.cylinder.factory.name})` : "—"} />
          {order.completedAt && <Info label="সম্পন্ন হয়েছে" value={fmtDateTime(order.completedAt)} />}
        </div>
        {order.notes && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-100">📝 {order.notes}</p>}
      </Card>

      {/* Quick actions */}
      {order.status === "ACTIVE" && (
        <Card>
          <CardTitle>কাজ করুন</CardTitle>
          <div className="space-y-2.5">
            {order.stage === "PLACED" && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                অ্যাডভান্স না নিলে কাজ শুরু হয় না — নিচে «পেমেন্ট যোগ করুন» দিয়ে অ্যাডভান্স এন্ট্রি করুন
              </p>
            )}
            {nextLabel && <AdvanceStageButton kind="packaging" id={order.id} label={nextLabel} />}
            {order.stage === "DELIVERED" && <AdvanceStageButton kind="packaging" id={order.id} label="✓ সম্পন্ন করুন" />}
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/payments/new?party=${order.partyId}`} variant="subtle" size="md">
                ৳ পেমেন্ট যোগ
              </LinkButton>
              <LinkButton href={`/expenses/new?packagingOrderId=${order.id}`} variant="subtle" size="md">
                খরচ যোগ
              </LinkButton>
              <EditPackagingOrderButton
                orderId={order.id}
                order={order}
                factories={factories}
                cylinders={cylinders.map((c) => ({ id: c.id, name: c.name, factoryId: c.factoryId, factoryName: c.factory.name }))}
              />
              <CancelOrderButton kind="packaging" id={order.id} label="বাতিল" />
            </div>
          </div>
        </Card>
      )}

      {order.status === "CANCELLED" && (
        <Card className="border-red-200 bg-red-50/60">
          <p className="text-sm font-bold text-red-700">বাতিল করা হয়েছে</p>
          <p className="mt-1 text-sm text-red-600">
            {order.cancelReason} — {order.cancelledBy?.name} · {fmtDateTime(order.cancelledAt)}
          </p>
        </Card>
      )}

      {/* Payment summary: bill / advance / paid / due */}
      <Card>
        <CardTitle right={<LinkButton href={`/payments/new?party=${order.partyId}`} size="sm" variant="subtle">+ পেমেন্ট</LinkButton>}>
          পেমেন্ট সারসংক্ষেপ
        </CardTitle>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4">
          <Sum label="টোটাল বিল" value={bnMoney(order.totalBill)} />
          <Sum label="অ্যাডভান্স" value={bnMoney(advance)} tone="blue" />
          <Sum label="মোট জমা" value={bnMoney(paid)} tone="green" />
          <Sum label="বাকি" value={bnMoney(Math.max(due, 0))} tone={due > 0 ? "red" : "green"} />
        </div>
        {payments.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {payments.map((p) => (
              <li key={p.allocationId} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/payments/${p.paymentId}`} className="text-sm font-bold text-slate-800 hover:text-brand-700">
                    TXN-{bn(p.txnNo)}
                  </Link>
                  {p.isAdvance && <Badge tone="blue" className="ml-1.5">অ্যাডভান্স</Badge>}
                  {p.voidedAt && <Badge tone="red" className="ml-1.5">বাতিল</Badge>}
                  <span className="ml-2 text-xs text-slate-500">
                    {p.accountName} · {p.createdByName} · {fmtDateShort(p.date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-extrabold ${p.voidedAt ? "text-slate-400 line-through" : "text-slate-900"}`}>{bnMoney(p.amount)}</p>
                  {!p.voidedAt && <VoidPaymentButton paymentId={p.paymentId} amount={p.amount} />}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">এখনও কোনো পেমেন্ট নেই</p>
        )}
      </Card>

      {/* Expenses */}
      <Card>
        <CardTitle right={<LinkButton href={`/expenses/new?packagingOrderId=${order.id}`} size="sm" variant="subtle">+ খরচ</LinkButton>}>
          এই অর্ডারের খরচ
        </CardTitle>
        {expenses.length === 0 ? (
          <Empty text="কোনো খরচ নেই" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${e.voidedAt ? "text-slate-400 line-through" : "text-slate-800"}`}>{e.description}</p>
                  <p className="text-xs text-slate-500">
                    {EXPENSE_CATEGORY_BN[e.category]} · {e.createdByName} · {fmtDateShort(e.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-extrabold ${e.voidedAt ? "text-slate-400 line-through" : "text-red-600"}`}>{bnMoney(e.amount)}</p>
                  {!e.voidedAt && <VoidExpenseButton expenseId={e.id} amount={e.amount} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Activity */}
      <Card>
        <CardTitle>অ্যাক্টিভিটি</CardTitle>
        {events.length === 0 ? (
          <Empty text="কিছু নেই" />
        ) : (
          <ul className="space-y-2.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-800">
                  {(e.actorName ?? "—").slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-slate-700">
                    <span className="font-bold">{e.actorName ?? "সিস্টেম"}</span> — {e.detail ?? e.action}
                  </p>
                  <p className="text-[11px] text-slate-400">{fmtDateTime(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
          সর্বশেষ আপডেট: {order.updatedBy?.name ?? order.createdBy.name} · {fmtDateTime(order.updatedAt)}
        </p>
      </Card>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-0.5 font-bold ${highlight ? "text-amber-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function Sum({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "blue" }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2.5 py-2.5 ring-1 ring-inset ring-slate-100">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm font-extrabold sm:text-base ${
          tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : tone === "blue" ? "text-sky-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
