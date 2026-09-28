import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartyLedger } from "@/server/services/payments";
import { PageHead } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { VoidPaymentButton } from "@/components/forms/money-actions";
import { PACKAGING_STAGE_BN, STATUS_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PartyLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartyLedger(id);
  if (!data) notFound();
  const { party, orders, payments, totalBill, totalPaid, totalDue } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHead
        title={party.name}
        sub={`${party.phone ?? "ফোন নেই"}${party.address ? ` · ${party.address}` : ""}`}
        right={
          <div className="flex gap-2">
            <LinkButton href={`/payments/new?party=${party.id}`} size="md">৳ পেমেন্ট</LinkButton>
            <LinkButton href="/packaging/new" size="md" variant="secondary">+ অর্ডার</LinkButton>
          </div>
        }
      />
      {party.notes && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-100">📝 {party.notes}</p>}

      <div className="grid grid-cols-3 gap-2">
        <Ledger label="মোট বিল" value={bnMoney(totalBill)} />
        <Ledger label="মোট জমা" value={bnMoney(totalPaid)} tone="green" />
        <Ledger label="মোট বাকি" value={bnMoney(Math.max(totalDue, 0))} tone={totalDue > 0 ? "red" : "green"} extra={totalDue < 0 ? `অ্যাডভান্স ${bnMoney(-totalDue)}` : undefined} />
      </div>

      <Card>
        <CardTitle>অর্ডারসমূহ</CardTitle>
        {orders.length === 0 ? (
          <Empty text="কোনো অর্ডার নেই" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => {
              const due = Math.round((o.totalBill - o.paid) * 100) / 100;
              return (
                <li key={o.id}>
                  <Link href={`/packaging/${o.id}`} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">PKG-{bn(o.orderNo)}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={"status" in o && o.status === "COMPLETED" ? "green" : "blue"}>
                          {"status" in o && o.status === "COMPLETED" ? STATUS_BN.COMPLETED : PACKAGING_STAGE_BN[o.stage] ?? o.stage}
                        </Badge>
                        {due > 0 && <Badge tone="red">বাকি {bnMoney(due)}</Badge>}
                        <span className="text-[11px] text-slate-400">{fmtDateShort(o.createdAt)}</span>
                        {"status" in o && o.status !== "COMPLETED" && <AgeChip from={o.createdAt} />}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">{bnMoney(o.totalBill)}</p>
                      <p className="text-[11px] text-slate-400">জমা {bnMoney(o.paid)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle right={<LinkButton href={`/payments/new?party=${party.id}`} size="sm" variant="subtle">+ পেমেন্ট</LinkButton>}>
          পেমেন্ট হিস্টোরি
        </CardTitle>
        {payments.length === 0 ? (
          <Empty text="কোনো পেমেন্ট নেই" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/payments/${p.id}`} className="text-sm font-bold text-slate-800 hover:text-brand-700">
                    TXN-{bn(p.txnNo)}
                  </Link>
                  {p.voidedAt && <Badge tone="red" className="ml-1.5">বাতিল</Badge>}
                  <p className="text-xs text-slate-500">
                    {p.accountName} · {p.createdByName} · {fmtDateShort(p.date)}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-extrabold ${p.voidedAt ? "text-slate-400 line-through" : "text-emerald-700"}`}>+{bnMoney(p.amount)}</p>
                  {!p.voidedAt && <VoidPaymentButton paymentId={p.id} amount={p.amount} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Ledger({ label, value, tone, extra }: { label: string; value: string; tone?: "green" | "red"; extra?: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold sm:text-xl ${tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      {extra && <p className="mt-0.5 text-[11px] font-bold text-emerald-600">{extra}</p>}
    </Card>
  );
}
