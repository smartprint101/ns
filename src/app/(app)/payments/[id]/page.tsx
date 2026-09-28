import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayment } from "@/server/services/payments";
import { PageHead } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty } from "@/components/ui";
import { VoidPaymentButton } from "@/components/forms/money-actions";
import { PAYMENT_SOURCE_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDate, fmtDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPayment(id);
  if (!data) notFound();
  const { payment: p, allocations, events } = data;
  const allocSum = allocations.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHead
        title={`পেমেন্ট TXN-${bn(p.txnNo)}`}
        sub={`${fmtDate(p.date)} · ${p.createdBy.name} এন্ট্রি করেছেন`}
        right={
          p.voidedAt ? <Badge tone="red">বাতিল</Badge> : <Badge tone="green">সচল</Badge>
        }
      />

      <Card>
        <p className="text-3xl font-extrabold text-slate-900">{bnMoney(p.amount)}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Info label="পার্টি/কাস্টমার" value={p.party?.name ?? p.customer?.name ?? "—"} />
          <Info label="পেমেন্ট মেথড" value={p.account.nameBn} />
          <Info label="ধরন" value={PAYMENT_SOURCE_BN[p.source]} />
          <Info label="অ্যাডভান্স" value={p.isAdvance ? "হ্যাঁ" : "না"} />
        </div>
        {p.notes && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-100">📝 {p.notes}</p>}
        {p.voidedAt && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            বাতিল: {p.voidReason} · {fmtDateTime(p.voidedAt)}
          </p>
        )}
        {!p.voidedAt && (
          <div className="mt-4">
            <VoidPaymentButton paymentId={p.id} amount={p.amount} />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>অর্ডারে বণ্টন ({bn(allocations.length)}টি · {bnMoney(allocSum)})</CardTitle>
        {allocations.length === 0 ? (
          <Empty text="কোনো অর্ডারে বণ্টন করা হয়নি — সাধারণ এন্ট্রি" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                <Link
                  href={a.regularOrderId ? `/orders/${a.regularOrderId}` : `/packaging/${a.packagingOrderId}`}
                  className="text-sm font-bold text-slate-800 hover:text-brand-700"
                >
                  {a.regularOrderId ? `অর্ডার #${bn(a.regularOrderNo ?? 0)}` : `PKG-${bn(a.packagingOrderNo ?? 0)}`} →
                </Link>
                <p className="text-sm font-extrabold text-slate-900">{bnMoney(a.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
          সর্বশেষ আপডেট: {p.updatedBy?.name ?? p.createdBy.name} · {fmtDateTime(p.updatedAt)}
        </p>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-0.5 font-bold text-slate-800">{value}</p>
    </div>
  );
}
