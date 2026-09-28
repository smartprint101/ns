import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegularOrder } from "@/server/services/regular-orders";
import { PageHead } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { AdvanceStageButton, CancelOrderButton, EditRegularOrderButton } from "@/components/forms/order-actions";
import { REGULAR_STAGE_BN, STATUS_BN, EXPENSE_CATEGORY_BN, PAYMENT_SOURCE_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDate, fmtDateTime, fmtDateShort } from "@/lib/dates";
import { VoidPaymentButton, VoidExpenseButton } from "@/components/forms/money-actions";

export const dynamic = "force-dynamic";

const stageTone: Record<string, "blue" | "amber" | "red" | "green" | "violet"> = {
  PLACED: "blue",
  READY: "violet",
  COURIER_GIVEN: "amber",
  CONDITION_PENDING: "red",
  COMPLETED: "green",
};

export default async function RegularOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRegularOrder(id);
  if (!data) notFound();
  const { order, paid, payments, expenses, events } = data;
  const due = Math.round((order.totalAmount - paid) * 100) / 100;
  
  const nextLabel =
    order.status === "ACTIVE"
      ? order.stage === "PLACED"
        ? "✓ স্লিপ তৈরি হয়েছে"
        : order.stage === "READY"
          ? order.hasCondition
            ? "🚚 কুরিয়ারে পাঠানো হলো (কন্ডিশন বকেয়া হবে)"
            : due > 0
              ? "🚚 কুরিয়ারে পাঠানো হলো (বকেয়া থাকবে)"
              : "🚚 কুরিয়ারে পাঠানো হলো — সম্পন্ন"
          : null
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHead
        title={`অর্ডার #${bn(order.orderNo)}`}
        sub={`${fmtDate(order.createdAt)} · ${order.createdBy.name} তৈরি করেছেন`}
        right={
          <div className="flex gap-1.5">
            <Badge tone={stageTone[order.stage] ?? "slate"}>{REGULAR_STAGE_BN[order.stage]}</Badge>
            <Badge tone={order.status === "COMPLETED" ? "green" : order.status === "CANCELLED" ? "red" : "blue"}>{STATUS_BN[order.status]}</Badge>
          </div>
        }
      />

      {/* Top summary */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900">{order.customer.name}</p>
            <p className="text-sm text-slate-500">
              {order.customer.phone && <span>{order.customer.phone} · </span>}
              {order.address ?? order.customer.address ?? "ঠিকানা নেই"}
            </p>
          </div>
          {order.status === "ACTIVE" && <AgeChip from={order.createdAt} />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-3">
          <Info label="মোট টাকা" value={bnMoney(order.totalAmount)} />
          <Info label="কন্ডিশন" value={order.hasCondition ? "আছে" : "নেই"} highlight={order.hasCondition} />
          {order.productName && <Info label="পণ্য" value={order.productName} />}
          {order.courierGivenAt && <Info label="কুরিয়ারে পাঠানো" value={fmtDateTime(order.courierGivenAt)} />}
        </div>
        {order.notes && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-100">📝 {order.notes}</p>}
      </Card>

      {/* Quick actions */}
      {order.status === "ACTIVE" && (
        <Card>
          <CardTitle>কাজ করুন</CardTitle>
          <div className="space-y-2.5">
            {nextLabel && <AdvanceStageButton kind="regular" id={order.id} label={nextLabel} />}
            {order.stage === "CONDITION_PENDING" && (
              <LinkButton href={`/conditions`} variant="primary" size="lg" full>
                ৳ কন্ডিশন রিসিভ করুন ({bnMoney(order.totalAmount)} আসার কথা)
              </LinkButton>
            )}
            {order.stage === "COURIER_GIVEN" && due > 0 && (
              <LinkButton href={`/payments/new?customer=${order.customerId}`} variant="primary" size="lg" full>
                ৳ বকেয়া {bnMoney(due)} — টাকা পেলে এন্ট্রি করুন
              </LinkButton>
            )}
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/payments/new?customer=${order.customerId}`} variant="subtle" size="md">
                ৳ পেমেন্ট
              </LinkButton>
              <LinkButton href={`/expenses/new?regularOrderId=${order.id}`} variant="subtle" size="md">
                খরচ যোগ
              </LinkButton>
              <EditRegularOrderButton orderId={order.id} order={order} />
              <CancelOrderButton kind="regular" id={order.id} label="বাতিল" />
            </div>
          </div>
        </Card>
      )}

      {/* Cancelled info */}
      {order.status === "CANCELLED" && (
        <Card className="border-red-200 bg-red-50/60">
          <p className="text-sm font-bold text-red-700">বাতিল করা হয়েছে</p>
          <p className="mt-1 text-sm text-red-600">
            {order.cancelReason} — {order.cancelledBy?.name} · {fmtDateTime(order.cancelledAt)}
          </p>
        </Card>
      )}

      {/* Payment summary */}
      <Card>
        <CardTitle right={<LinkButton href={`/payments/new?customer=${order.customerId}`} size="sm" variant="subtle">+ পেমেন্ট</LinkButton>}>
          পেমেন্ট সারসংক্ষেপ
        </CardTitle>
        <div className="grid grid-cols-3 gap-2">
          <Sum label="মোট বিল" value={bnMoney(order.totalAmount)} />
          <Sum label="জমা" value={bnMoney(paid)} tone="green" />
          <Sum label="বাকি" value={bnMoney(Math.max(due, 0))} tone={due > 0 ? "red" : "green"} extra={due < 0 ? `অতিরিক্ত জমা ${bnMoney(-due)}` : undefined} />
        </div>
        {order.conditionAmount && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            ✓ কন্ডিশন রিসিভ হয়েছে: {bnMoney(order.conditionAmount)} · {order.conditionReceivedBy?.name} · {fmtDateTime(order.conditionReceivedAt)}
          </p>
        )}
        {payments.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {payments.map((p) => (
              <li key={p.allocationId} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/payments/${p.paymentId}`} className="text-sm font-bold text-slate-800 hover:text-brand-700">
                    TXN-{bn(p.txnNo)}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">
                    {p.accountName} · {PAYMENT_SOURCE_BN[p.source] ?? p.source} · {p.createdByName}
                  </span>
                  {p.voidedAt && <Badge tone="red" className="ml-2">বাতিল</Badge>}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-extrabold ${p.voidedAt ? "text-slate-400 line-through" : "text-slate-900"}`}>{bnMoney(p.amount)}</p>
                  <p className="text-[11px] text-slate-400">{fmtDateShort(p.date)}</p>
                </div>
                {!p.voidedAt && <VoidPaymentButton paymentId={p.paymentId} amount={p.amount} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Expenses linked */}
      <Card>
        <CardTitle right={<LinkButton href={`/expenses/new?regularOrderId=${order.id}`} size="sm" variant="subtle">+ খরচ</LinkButton>}>
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

      {/* Activity: who updated what */}
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

function Sum({ label, value, tone, extra }: { label: string; value: string; tone?: "green" | "red"; extra?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={`mt-0.5 text-base font-extrabold ${tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      {extra && <p className="text-[10px] font-semibold text-emerald-600">{extra}</p>}
    </div>
  );
}
